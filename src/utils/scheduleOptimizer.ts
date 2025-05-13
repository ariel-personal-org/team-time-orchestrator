
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { WorkPeriod } from '../components/WorkPeriodList';
import { ScheduleGrid, ShiftRecord, UserProfile } from '../types/scheduleTypes';

export const optimizeSchedule = (
  workPeriod: WorkPeriod,
  assignedUsers: UserProfile[],
  scheduleGrid: ScheduleGrid
): ScheduleGrid => {
  if (!workPeriod || !assignedUsers || !scheduleGrid) return scheduleGrid;

  // Create a copy of the current grid to work with
  const newGrid: ScheduleGrid = JSON.parse(JSON.stringify(scheduleGrid));
  const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
  const userIds = assignedUsers.map(user => user.id);
  
  // For each day in the work period
  for (let i = 0; i < days; i++) {
    const date = addDays(parseISO(workPeriod.start_date), i);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Count currently assigned users for this date
    let assignedCount = 0;
    userIds.forEach(userId => {
      if (newGrid[userId] && newGrid[userId][dateKey] && newGrid[userId][dateKey].assigned) {
        assignedCount++;
      }
    });
    
    // If we need more assignments
    if (assignedCount < workPeriod.needed_capacity) {
      // Sort users by total assigned shifts (ascending)
      const sortedUsers = [...userIds].sort((a, b) => {
        const aAssignments = Object.values(newGrid[a] || {})
          .filter(cell => cell && cell.assigned).length;
        const bAssignments = Object.values(newGrid[b] || {})
          .filter(cell => cell && cell.assigned).length;
        return aAssignments - bAssignments;
      });
      
      // Assign shifts to users with fewer shifts
      for (const userId of sortedUsers) {
        if (!newGrid[userId] || !newGrid[userId][dateKey]) continue;
        
        const cellData = newGrid[userId][dateKey];
        
        // Skip if already assigned, locked, or requested off
        if (cellData.assigned || cellData.locked || cellData.requested_off) {
          continue;
        }
        
        // Assign shift
        newGrid[userId][dateKey].assigned = true;
        
        assignedCount++;
        if (assignedCount >= workPeriod.needed_capacity) {
          break;
        }
      }
    }
    // If we have too many assignments
    else if (assignedCount > workPeriod.needed_capacity) {
      // Sort users by total assigned shifts (descending)
      const sortedUsers = [...userIds].sort((a, b) => {
        const aAssignments = Object.values(newGrid[a] || {})
          .filter(cell => cell && cell.assigned).length;
        const bAssignments = Object.values(newGrid[b] || {})
          .filter(cell => cell && cell.assigned).length;
        return bAssignments - aAssignments;
      });
      
      // Remove shifts from users with more shifts
      for (const userId of sortedUsers) {
        if (!newGrid[userId] || !newGrid[userId][dateKey]) continue;
        
        const cellData = newGrid[userId][dateKey];
        
        // Skip if locked
        if (cellData.locked) {
          continue;
        }
        
        // Unassign shift if currently assigned
        if (cellData.assigned) {
          newGrid[userId][dateKey].assigned = false;
          
          assignedCount--;
          if (assignedCount <= workPeriod.needed_capacity) {
            break;
          }
        }
      }
    }
  }
  
  return newGrid;
};
