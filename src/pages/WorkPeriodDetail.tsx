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
import { Lock, UserPlus, UserMinus, Users, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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
  const { isAdmin, user } = useAuth();
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, Record<string, CellData>>>({});
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('schedule');
  
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
  const { data: assignedUsers, isLoading: isLoadingUsers, refetch: refetchAssignedUsers } = useQuery({
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

  // Fetch all users for the user management dialog
  const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isUserDialogOpen && isAdmin
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

  // Mutation for adding a user to a work period
  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('work_period_assignments')
        .insert([{ work_period_id: id!, user_id: userId }])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodUsers', id] });
      toast({
        title: 'User added',
        description: 'User has been added to the work period.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error adding user',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation for removing a user from a work period
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete both assignment and shifts for this user in this work period
      const { error: assignmentError } = await supabase
        .from('work_period_assignments')
        .delete()
        .eq('work_period_id', id!)
        .eq('user_id', userId);
      
      if (assignmentError) throw assignmentError;
      
      // Also delete shifts for this user in this work period
      const { error: shiftsError } = await supabase
        .from('shifts')
        .delete()
        .eq('work_period_id', id!)
        .eq('user_id', userId);
      
      if (shiftsError) throw shiftsError;
      
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodUsers', id] });
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', id] });
      toast({
        title: 'User removed',
        description: 'User has been removed from the work period.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error removing user',
        description: error.message,
        variant: 'destructive'
      });
    }
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
      return data[0] as ShiftRecord;
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
      return data[0] as ShiftRecord;
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

  // Mutation for assigning a user to a shift row
  const assignUserToShiftMutation = useMutation({
    mutationFn: async ({ dateKey, capacityIndex, userId }: { dateKey: string, capacityIndex: number, userId: string }) => {
      // First check if there's already a shift for this user on this date
      const { data: existingShifts, error: fetchError } = await supabase
        .from('shifts')
        .select('*')
        .eq('work_period_id', id!)
        .eq('user_id', userId)
        .eq('shift_date', dateKey);
        
      if (fetchError) throw fetchError;
      
      // If a shift exists for this user on this date, update it
      if (existingShifts && existingShifts.length > 0) {
        const { data, error } = await supabase
          .from('shifts')
          .update({ assigned: true })
          .eq('id', existingShifts[0].id)
          .select();
          
        if (error) throw error;
        return data[0] as ShiftRecord;
      }
      
      // Otherwise create a new shift
      const { data, error } = await supabase
        .from('shifts')
        .insert([{
          work_period_id: id!,
          user_id: userId,
          shift_date: dateKey,
          assigned: true,
          locked: false,
          requested_off: false
        }])
        .select();
        
      if (error) throw error;
      return data[0] as ShiftRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', id] });
      toast({
        title: 'User assigned',
        description: 'User has been assigned to the shift.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error assigning user',
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

  const handleAddUser = (userId: string) => {
    addUserMutation.mutate(userId);
  };

  const handleRemoveUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  const handleAssignUserToShift = (dateKey: string, capacityIndex: number, userId: string) => {
    assignUserToShiftMutation.mutate({ dateKey, capacityIndex, userId });
  };

  const getUserDisplayName = (user: UserProfile) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.id;
  };

  // Get users assigned to a specific date
  const getUsersAssignedToDate = (dateKey: string): string[] => {
    if (!shifts) return [];
    return shifts
      .filter(shift => shift.shift_date === dateKey && shift.assigned)
      .map(shift => shift.user_id);
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
          <div className="flex flex-wrap gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-[calc(25%-1rem)]" />
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
  const filteredUsers = allUsers ? allUsers.filter(user => 
    (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : [];
  
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

        {/* More compact stats display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">Needed Capacity</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{workPeriod.needed_capacity}</div>
              <p className="text-xs text-muted-foreground">Users per shift</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">Users Assigned</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{assignedUsers.length}</div>
              <p className="text-xs text-muted-foreground">Total users</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{dates.length}</div>
              <p className="text-xs text-muted-foreground">Days in period</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">Days-Off Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">
                {shifts ? shifts.filter(shift => shift.requested_off).length : 0}
              </div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="users">
              Users
              <Badge variant="secondary" className="ml-2">{assignedUsers.length}</Badge>
            </TabsTrigger>
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
                    <th className="border bg-muted px-4 py-2 text-left min-w-[180px]">
                      <div className="font-medium">Shift Position</div>
                    </th>
                    {dates.map((date) => (
                      <th key={date.toString()} className="border bg-muted px-4 py-2 text-center" style={{ minWidth: '100px' }}>
                        <div>{format(date, 'EEE')}</div>
                        <div className="text-xs">{format(date, 'MMM d')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Create rows based on needed capacity */}
                  {[...Array(workPeriod.needed_capacity)].map((_, posIndex) => {
                    return (
                      <tr key={`position-${posIndex}`}>
                        <td className="border px-4 py-2 bg-gray-50 font-medium">
                          Position {posIndex + 1}
                        </td>
                        {dates.map((date) => {
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const assignedUsers = getUsersAssignedToDate(dateKey);
                          const userForThisPosition = assignedUsers[posIndex];
                          
                          // Find the user object if assigned
                          const assignedUser = userForThisPosition ? 
                            assignedUsers?.find(u => u.id === userForThisPosition) : 
                            null;
                          
                          return (
                            <td key={dateKey} className="border px-1 py-1 text-center relative">
                              {isAdmin ? (
                                <select
                                  className="w-full h-10 px-2 py-1 text-sm border-0 focus:ring-0"
                                  value={userForThisPosition || ""}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAssignUserToShift(dateKey, posIndex, e.target.value);
                                    }
                                  }}
                                >
                                  <option value="">Assign user</option>
                                  {assignedUsers.map((user) => (
                                    <option 
                                      key={user.id} 
                                      value={user.id}
                                      disabled={assignedUsers.includes(user.id) && user.id !== userForThisPosition}
                                    >
                                      {getUserDisplayName(user)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex justify-center items-center h-10">
                                  {userForThisPosition ? 
                                    getUserDisplayName(assignedUser as UserProfile) : 
                                    'Unassigned'}
                                </div>
                              )}
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
              {isAdmin ? 'Select users from the dropdown to assign them to shifts.' : 
               'Contact an administrator to request changes to your schedule.'}
            </p>
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            {isAdmin && (
              <div className="mb-4 flex justify-end">
                <Button 
                  onClick={() => setIsUserDialogOpen(true)}
                  className="flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Add Users
                </Button>
              </div>
            )}
            
            <div className="bg-white rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Name</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedUsers.length > 0 ? (
                    assignedUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>{(user.first_name?.[0] || '') + (user.last_name?.[0] || '')}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{user.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getUserDisplayName(user)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemoveUser(user.id)}
                              className="h-8 px-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <UserMinus className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 3 : 2} className="text-center py-4 text-muted-foreground">
                        No users assigned to this work period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="requests">
            <div className="bg-white rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested On</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts && shifts.filter(shift => shift.requested_off).length > 0 ? (
                    shifts.filter(shift => shift.requested_off).map(shift => {
                      const user = assignedUsers.find(u => u.id === shift.user_id);
                      return (
                        <TableRow key={shift.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarFallback>{user ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '') : 'U'}</AvatarFallback>
                              </Avatar>
                              <span>{user ? getUserDisplayName(user) : shift.user_id}</span>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(shift.shift_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{format(new Date(shift.created_at), 'MMM d, yyyy')}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  updateShiftMutation.mutate({
                                    shiftId: shift.id,
                                    updates: { requested_off: false, assigned: false }
                                  });
                                }}
                                className="h-8 px-3 text-green-600"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  updateShiftMutation.mutate({
                                    shiftId: shift.id,
                                    updates: { requested_off: false }
                                  });
                                }}
                                className="h-8 px-3 text-red-600"
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Deny
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-4 text-muted-foreground">
                        No day-off requests for this work period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* User management dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Users to Work Period</DialogTitle>
            <DialogDescription>
              Select users to add to this work period. They will be available for shift assignments.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {isLoadingAllUsers ? (
                <div className="p-4 text-center">Loading users...</div>
              ) : filteredUsers.length > 0 ? (
                <Table>
                  <TableBody>
                    {filteredUsers.map(user => {
                      const isAssigned = assignedUsers?.some(au => au.id === user.id);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarFallback>{(user.first_name?.[0] || '') + (user.last_name?.[0] || '')}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{getUserDisplayName(user)}</div>
                                <div className="text-xs text-muted-foreground">{user.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAssigned ? (
                              <Badge variant="secondary" className="bg-gray-100">Assigned</Badge>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  handleAddUser(user.id);
                                }}
                              >
                                Add
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No users found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default WorkPeriodDetail;
