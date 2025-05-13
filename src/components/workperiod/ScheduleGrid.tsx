import React from 'react';
import { format, parseISO } from 'date-fns';
import { Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WorkPeriod } from '@/components/WorkPeriodList';
import { UserProfile, ScheduleGrid as ScheduleGridType, ShiftRecord } from '@/types/scheduleTypes';
import { useToast } from '@/components/ui/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDates, getAssignedCountForDate, isColumnLocked, getUserDisplayName } from '@/utils/scheduleUtils';
import { optimizeSchedule } from '@/utils/scheduleOptimizer';

interface ScheduleGridProps {
  workPeriodId: string;
  workPeriod: WorkPeriod;
  assignedUsers: UserProfile[];
  scheduleGrid: ScheduleGridType;
  setScheduleGrid: React.Dispatch<React.SetStateAction<ScheduleGridType>>;
  isAdmin: boolean;
}

const ScheduleGridComponent: React.FC<ScheduleGridProps> = ({ 
  workPeriodId, 
  workPeriod, 
  assignedUsers, 
  scheduleGrid, 
  setScheduleGrid, 
  isAdmin 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dates = getDates(workPeriod);

  // Mutation for updating a shift
  const updateShiftMutation = useMutation({
    mutationFn: async ({ shiftId, updates }: { shiftId: string, updates: Partial<ShiftRecord> }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', shiftId)
        .select();
      
      if (error) throw error;
      return data[0] as ShiftRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', workPeriodId] });
    },
    onError: (error) => {
      toast({
        title: 'Error updating shift',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation for creating a shift
  const createShiftMutation = useMutation({
    mutationFn: async (newShift: Omit<ShiftRecord, 'id'>) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert([newShift])
        .select();
      
      if (error) throw error;
      return data[0] as ShiftRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', workPeriodId] });
    },
    onError: (error) => {
      toast({
        title: 'Error creating shift',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Toggle cell assignment status
  const toggleAssignment = async (userId: string, dateKey: string) => {
    if (!isAdmin) return;
    
    const cellData = scheduleGrid[userId][dateKey];
    
    // If the cell is locked, don't allow changes
    if (cellData.locked) return;
    
    // Update the UI optimistically
    setScheduleGrid(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [dateKey]: {
          ...prev[userId][dateKey],
          assigned: !prev[userId][dateKey].assigned,
        }
      }
    }));
    
    // If we already have a shift record, update it
    if (cellData.id) {
      updateShiftMutation.mutate({ 
        shiftId: cellData.id, 
        updates: { assigned: !cellData.assigned } 
      });
    } else {
      // Otherwise create a new shift record
      createShiftMutation.mutate({
        work_period_id: workPeriodId,
        user_id: userId,
        shift_date: dateKey,
        assigned: !cellData.assigned,
        locked: cellData.locked,
        requested_off: cellData.requested_off
      });
    }
  };

  // Toggle cell lock status
  const toggleLock = async (userId: string, dateKey: string) => {
    if (!isAdmin) return;
    
    const cellData = scheduleGrid[userId][dateKey];
    
    // Update the UI optimistically
    setScheduleGrid(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [dateKey]: {
          ...prev[userId][dateKey],
          locked: !prev[userId][dateKey].locked,
        }
      }
    }));
    
    // If we already have a shift record, update it
    if (cellData.id) {
      updateShiftMutation.mutate({ 
        shiftId: cellData.id, 
        updates: { locked: !cellData.locked } 
      });
    } else {
      // Otherwise create a new shift record
      createShiftMutation.mutate({
        work_period_id: workPeriodId,
        user_id: userId,
        shift_date: dateKey,
        assigned: cellData.assigned,
        locked: !cellData.locked,
        requested_off: cellData.requested_off
      });
    }
  };

  // Toggle lock status for an entire column (date)
  const toggleColumnLock = async (dateKey: string) => {
    if (!isAdmin || !assignedUsers) return;
    
    // Check if the column is currently locked (if any cell is locked)
    const isColLocked = isColumnLocked(dateKey, assignedUsers, scheduleGrid);
    
    // Toggle lock state for all cells in the column
    const newLockState = !isColLocked;
    
    // Update UI optimistically
    const newGrid = { ...scheduleGrid };
    assignedUsers.forEach(user => {
      if (newGrid[user.id]?.[dateKey]) {
        newGrid[user.id][dateKey].locked = newLockState;
      }
    });
    
    setScheduleGrid(newGrid);
    
    // Update or create shift records
    const promises: Promise<any>[] = [];
    
    assignedUsers.forEach(user => {
      const cellData = scheduleGrid[user.id]?.[dateKey];
      if (!cellData) return;
      
      if (cellData.id) {
        promises.push(updateShiftMutation.mutateAsync({
          shiftId: cellData.id,
          updates: { locked: newLockState }
        }));
      } else {
        promises.push(createShiftMutation.mutateAsync({
          work_period_id: workPeriodId,
          user_id: user.id,
          shift_date: dateKey,
          assigned: cellData.assigned,
          locked: newLockState,
          requested_off: cellData.requested_off
        }));
      }
    });
    
    try {
      await Promise.all(promises);
      toast({
        title: `Column ${newLockState ? 'Locked' : 'Unlocked'}`,
        description: `All shifts for ${format(parseISO(dateKey), 'MMM d')} have been ${newLockState ? 'locked' : 'unlocked'}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error updating shifts',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Run optimizer
  const runOptimizer = async () => {
    if (!isAdmin || !workPeriod || !assignedUsers) return;

    // Optimize the schedule
    const newGrid = optimizeSchedule(workPeriod, assignedUsers, scheduleGrid);
    
    // Apply changes to the grid and save to database
    setScheduleGrid(newGrid);
    
    // Save all changes to the database
    const promises: Promise<any>[] = [];
    const userIds = assignedUsers.map(user => user.id);
    
    userIds.forEach(userId => {
      if (!newGrid[userId]) return;
      
      const days = dates.length;
      
      for (let i = 0; i < days; i++) {
        const dateKey = format(dates[i], 'yyyy-MM-dd');
        
        if (!scheduleGrid[userId] || !scheduleGrid[userId][dateKey] || !newGrid[userId][dateKey]) continue;
        
        const oldCell = scheduleGrid[userId][dateKey];
        const newCell = newGrid[userId][dateKey];
        
        // Only update if something changed
        if (
          oldCell.assigned !== newCell.assigned ||
          oldCell.locked !== newCell.locked ||
          oldCell.requested_off !== newCell.requested_off
        ) {
          // If the cell has an ID, update it
          if (oldCell.id) {
            promises.push(updateShiftMutation.mutateAsync({
              shiftId: oldCell.id,
              updates: {
                assigned: newCell.assigned,
                locked: newCell.locked,
                requested_off: newCell.requested_off
              }
            }));
          } else {
            // Otherwise create a new shift
            promises.push(createShiftMutation.mutateAsync({
              work_period_id: workPeriodId,
              user_id: userId,
              shift_date: dateKey,
              assigned: newCell.assigned,
              locked: newCell.locked,
              requested_off: newCell.requested_off
            }));
          }
        }
      }
    });
    
    try {
      await Promise.all(promises);
      toast({
        title: 'Schedule Optimized',
        description: 'The schedule has been successfully optimized.',
      });
    } catch (error: any) {
      toast({
        title: 'Error Optimizing Schedule',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      {assignedUsers.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No users assigned to this work period yet.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-200 rounded mr-1"></div>
                <span className="text-sm">Assigned</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>
                <span className="text-sm">Unassigned</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-200 rounded mr-1"></div>
                <span className="text-sm">Day-off Requested</span>
              </div>
              <div className="flex items-center">
                <Lock className="w-4 h-4 mr-1" />
                <span className="text-sm">Locked</span>
              </div>
            </div>
            
            {isAdmin && (
              <Button onClick={runOptimizer}>Optimize Schedule</Button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border bg-muted px-4 py-2 text-left" style={{ minWidth: '150px' }}>User</th>
                  {dates.map((date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const assignedCount = getAssignedCountForDate(dateKey, assignedUsers, scheduleGrid);
                    const isColLocked = isColumnLocked(dateKey, assignedUsers, scheduleGrid);
                    
                    return (
                      <th key={date.toString()} className="border bg-muted px-4 py-2 text-center" style={{ minWidth: '100px' }}>
                        <div className="flex justify-between items-center">
                          <span>{format(date, 'EEE')}</span>
                          {isAdmin && (
                            <button 
                              className="opacity-60 hover:opacity-100" 
                              onClick={() => toggleColumnLock(dateKey)}
                            >
                              {isColLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        <div className="text-xs">{format(date, 'MMM d')}</div>
                        {workPeriod && (
                          <div className="text-xs mt-1">
                            <Badge 
                              variant={
                                assignedCount < workPeriod.needed_capacity 
                                  ? 'destructive' 
                                  : assignedCount === workPeriod.needed_capacity 
                                    ? 'default' 
                                    : 'secondary'
                              } 
                              className="text-xs px-2 py-0 h-5"
                            >
                              {assignedCount}/{workPeriod.needed_capacity}
                            </Badge>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {assignedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="border px-4 py-2 bg-gray-50 font-medium">
                      <div className="flex items-center gap-2">
                        {getUserDisplayName(user)}
                        {user.isAdmin ? (
                          <Badge variant="default" className="text-xs">Admin</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Regular</Badge>
                        )}
                      </div>
                    </td>
                    {dates.map((date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const cellData = scheduleGrid[user.id]?.[dateKey];
                      
                      if (!cellData) return <td key={dateKey} className="border px-4 py-2"></td>;
                      
                      // Determine cell background color based on state
                      let bgColor = 'bg-gray-200'; // default unassigned
                      if (cellData.assigned) bgColor = 'bg-green-200';
                      if (cellData.requested_off) bgColor = 'bg-red-200';
                      
                      return (
                        <td key={dateKey} className={`border px-1 py-1 text-center ${bgColor} relative`}>
                          <div className="flex flex-col h-10 justify-center">
                            {/* Click to toggle assignment */}
                            {isAdmin && (
                              <button 
                                className="absolute inset-0 w-full h-full opacity-0"
                                onClick={() => toggleAssignment(user.id, dateKey)}
                                disabled={cellData.locked}
                              ></button>
                            )}
                            
                            {/* Show locked status */}
                            {cellData.locked && (
                              <div className="absolute top-1 right-1">
                                <Lock className="w-3 h-3" />
                              </div>
                            )}
                            
                            {/* Right-click menu or secondary action */}
                            {isAdmin && (
                              <button 
                                className="absolute bottom-0 right-0 p-1 opacity-30 hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLock(user.id, dateKey);
                                }}
                              >
                                <Lock className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};

export default ScheduleGridComponent;
