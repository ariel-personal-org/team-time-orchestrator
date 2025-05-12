import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import Layout from '../components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { WorkPeriod } from '../components/WorkPeriodList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';

// Type for our cell data in the schedule
type CellData = {
  id?: string;
  assigned: boolean;
  locked: boolean;
  requested_off: boolean;
};

// Type for a shift record
type ShiftRecord = {
  id: string;
  work_period_id: string;
  user_id: string;
  shift_date: string;
  assigned: boolean;
  locked: boolean;
  requested_off: boolean;
};

// Type for a user profile
type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
};

const WorkPeriodDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, Record<string, CellData>>>({});

  // Fetch work period details
  const { data: workPeriod, isLoading: isLoadingWorkPeriod, error: workPeriodError } = useQuery({
    queryKey: ['workPeriod', id],
    queryFn: async () => {
      if (!id) throw new Error('Work period ID is required');
      
      const { data, error } = await supabase
        .from('work_periods')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as WorkPeriod;
    }
  });

  // Fetch users assigned to this work period
  const { data: assignedUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['workPeriodUsers', id],
    queryFn: async () => {
      if (!id) throw new Error('Work period ID is required');
      
      const { data: assignments, error: assignmentsError } = await supabase
        .from('work_period_assignments')
        .select('user_id')
        .eq('work_period_id', id);
        
      if (assignmentsError) throw assignmentsError;
      
      // If there are no assignments, return empty array
      if (!assignments || assignments.length === 0) return [];
      
      // Get user profiles for each assigned user
      const userIds = assignments.map(assignment => assignment.user_id);
      
      // Fetch user profiles from the auth.users table via profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      return profiles || [];
    }
  });

  // Fetch shifts for this work period
  const { data: shifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['workPeriodShifts', id],
    queryFn: async () => {
      if (!id) throw new Error('Work period ID is required');
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('work_period_id', id);
      
      if (error) throw error;
      return data as ShiftRecord[];
    },
    enabled: !!id
  });

  // Mutation for updating a shift
  const updateShiftMutation = useMutation({
    mutationFn: async ({ shiftId, updates }: { shiftId: string, updates: Partial<ShiftRecord> }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', shiftId)
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', id] });
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
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', id] });
    },
    onError: (error) => {
      toast({
        title: 'Error creating shift',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Initialize the schedule grid when data is loaded
  useEffect(() => {
    if (workPeriod && assignedUsers && shifts) {
      initializeScheduleGrid(workPeriod, assignedUsers, shifts);
    }
  }, [workPeriod, assignedUsers, shifts]);

  // Initialize schedule grid from DB data
  const initializeScheduleGrid = (workPeriod: WorkPeriod, users: UserProfile[], shifts: ShiftRecord[]) => {
    const grid: Record<string, Record<string, CellData>> = {};
    
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
    
    setScheduleGrid(grid);
  };

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
        work_period_id: id!,
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
        work_period_id: id!,
        user_id: userId,
        shift_date: dateKey,
        assigned: cellData.assigned,
        locked: !cellData.locked,
        requested_off: cellData.requested_off
      });
    }
  };

  // Run optimizer
  const runOptimizer = async () => {
    if (!isAdmin || !workPeriod || !assignedUsers) return;

    // Create a copy of the current grid to work with
    const newGrid = JSON.parse(JSON.stringify(scheduleGrid));
    const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
    const userIds = assignedUsers.map(user => user.id);
    
    // For each day in the work period
    for (let i = 0; i < days; i++) {
      const date = addDays(parseISO(workPeriod.start_date), i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      // Count currently assigned users for this date
      let assignedCount = 0;
      userIds.forEach(userId => {
        if (newGrid[userId][dateKey].assigned) {
          assignedCount++;
        }
      });
      
      // If we need more assignments
      if (assignedCount < workPeriod.needed_capacity) {
        // Sort users by total assigned shifts (ascending)
        const sortedUsers = [...userIds].sort((a, b) => {
          const aAssignments = Object.values(newGrid[a]).filter(cell => cell.assigned).length;
          const bAssignments = Object.values(newGrid[b]).filter(cell => cell.assigned).length;
          return aAssignments - bAssignments;
        });
        
        // Assign shifts to users with fewer shifts
        for (const userId of sortedUsers) {
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
          const aAssignments = Object.values(newGrid[a]).filter(cell => cell.assigned).length;
          const bAssignments = Object.values(newGrid[b]).filter(cell => cell.assigned).length;
          return bAssignments - aAssignments;
        });
        
        // Remove shifts from users with more shifts
        for (const userId of sortedUsers) {
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
    
    // Apply changes to the grid and save to database
    setScheduleGrid(newGrid);
    
    // Save all changes to the database
    const promises: Promise<any>[] = [];
    
    userIds.forEach(userId => {
      const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
      
      for (let i = 0; i < days; i++) {
        const date = addDays(parseISO(workPeriod.start_date), i);
        const dateKey = format(date, 'yyyy-MM-dd');
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
              work_period_id: id!,
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

  // Generate date headers for the schedule
  const getDates = () => {
    if (!workPeriod) return [];
    
    const dates = [];
    const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
    
    for (let i = 0; i < days; i++) {
      const date = addDays(parseISO(workPeriod.start_date), i);
      dates.push(date);
    }
    
    return dates;
  };

  // Loading state
  if (isLoadingWorkPeriod || isLoadingUsers || isLoadingShifts) {
    return (
      <Layout>
        <div className="container py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </Layout>
    );
  }

  // Error state
  if (workPeriodError) {
    return (
      <Layout>
        <div className="container py-6">
          <Alert variant="destructive">
            <AlertTitle>Work period not found</AlertTitle>
            <AlertDescription>
              The requested work period could not be found or an error occurred.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Go back to Work Periods
          </Button>
        </div>
      </Layout>
    );
  }

  // No data state
  if (!workPeriod || !assignedUsers) {
    return (
      <Layout>
        <div className="container py-6">
          <Alert>
            <AlertTitle>No data available</AlertTitle>
            <AlertDescription>
              No data is available for this work period.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Go back to Work Periods
          </Button>
        </div>
      </Layout>
    );
  }

  const dates = getDates();
  
  const getUserDisplayName = (user: UserProfile) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email || user.id;
  };
  
  return (
    <Layout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">{workPeriod.name}</h1>
            <p className="text-muted-foreground">
              {format(parseISO(workPeriod.start_date), 'MMMM d, yyyy')} - {format(parseISO(workPeriod.end_date), 'MMMM d, yyyy')}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => {}}>Edit Work Period</Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Needed Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workPeriod.needed_capacity}</div>
              <p className="text-xs text-muted-foreground">Users per shift</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Users Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedUsers.length}</div>
              <p className="text-xs text-muted-foreground">Total users</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dates.length}</div>
              <p className="text-xs text-muted-foreground">Days in period</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Days-Off Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {shifts ? shifts.filter(shift => shift.requested_off).length : 0}
              </div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="schedule" className="mb-6">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Day-Off Requests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedule" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
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
                    <th className="border bg-muted px-4 py-2 text-left">User</th>
                    {dates.map((date) => (
                      <th key={date.toString()} className="border bg-muted px-4 py-2 text-center" style={{ minWidth: '100px' }}>
                        <div>{format(date, 'EEE')}</div>
                        <div className="text-xs">{format(date, 'MMM d')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignedUsers.map((user) => {
                    return (
                      <tr key={user.id}>
                        <td className="border px-4 py-2">{getUserDisplayName(user)}</td>
                        {dates.map((date) => {
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const cellData = scheduleGrid[user.id]?.[dateKey] || { assigned: false, locked: false, requested_off: false };
                          
                          // Determine cell background color
                          let bgColor = 'bg-gray-200'; // Default unassigned
                          
                          if (cellData.assigned) {
                            bgColor = 'bg-green-200';
                          }
                          
                          if (cellData.requested_off) {
                            bgColor = 'bg-red-200';
                          }
                          
                          return (
                            <td 
                              key={dateKey} 
                              className={`border px-1 py-1 text-center relative cursor-pointer ${bgColor}`}
                              onClick={() => toggleAssignment(user.id, dateKey)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                toggleLock(user.id, dateKey);
                              }}
                            >
                              <div className="flex justify-center items-center h-10">
                                {cellData.assigned ? 'Working' : 'Off'}
                                {cellData.locked && (
                                  <Lock className="absolute top-1 right-1 w-3 h-3" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              {isAdmin ? 'Right-click to lock/unlock a cell. Locked cells will not be modified by the optimizer.' : ''}
            </p>
          </TabsContent>
          
          <TabsContent value="users">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <p>User management would be implemented here. This would allow adding or removing users from this work period.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="requests">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <p>Day-off requests management would be implemented here. This would allow reviewing and approving/rejecting day-off requests.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default WorkPeriodDetail;
