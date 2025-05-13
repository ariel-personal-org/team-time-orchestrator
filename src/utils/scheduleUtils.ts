
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { CellData, ShiftRecord, UserProfile, ScheduleGrid } from '../types/scheduleTypes';
import { WorkPeriod } from '../components/WorkPeriodList';

// Initialize schedule grid from DB data
export const initializeScheduleGrid = (
  workPeriod: WorkPeriod,
  users: UserProfile[],
  shifts: ShiftRecord[]
): ScheduleGrid => {
  const grid: ScheduleGrid = {};
  
  // Create an empty grid with all dates for all users
  users.forEach(user => {
    grid[user.id] = {};
    const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
    
    for (let i = 0; i < days; i++) {
      const date = addDays(parseISO(workPeriod.start_date), i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      grid[user.id][dateKey] = {
        assigned: false,
        locked: false,
        requested_off: false
      };
    }
  });
  
  // Fill in the grid with actual shift data
  shifts.forEach(shift => {
    if (grid[shift.user_id] && grid[shift.user_id][shift.shift_date]) {
      grid[shift.user_id][shift.shift_date] = {
        id: shift.id,
        assigned: shift.assigned,
        locked: shift.locked,
        requested_off: shift.requested_off
      };
    }
  });
  
  return grid;
};

// Generate date headers for the schedule
export const getDates = (workPeriod: WorkPeriod | null) => {
  if (!workPeriod) return [];
  
  const dates = [];
  const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
  
  for (let i = 0; i < days; i++) {
    const date = addDays(parseISO(workPeriod.start_date), i);
    dates.push(date);
  }
  
  return dates;
};

// Get count of assigned users for a date
export const getAssignedCountForDate = (
  dateKey: string,
  assignedUsers: UserProfile[] | undefined,
  scheduleGrid: ScheduleGrid
): number => {
  if (!assignedUsers || !scheduleGrid) return 0;
  
  let count = 0;
  assignedUsers.forEach(user => {
    if (scheduleGrid[user.id]?.[dateKey]?.assigned) {
      count++;
    }
  });
  
  return count;
};

// Check if a column is fully locked
export const isColumnLocked = (
  dateKey: string,
  assignedUsers: UserProfile[] | undefined,
  scheduleGrid: ScheduleGrid
): boolean => {
  if (!assignedUsers || !scheduleGrid) return false;
  
  return assignedUsers.every(user => 
    scheduleGrid[user.id]?.[dateKey]?.locked
  );
};

// Generate display name for user
export const getUserDisplayName = (user: UserProfile): string => {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.id;
};
