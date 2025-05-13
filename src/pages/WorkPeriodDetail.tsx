
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
import { UserPlus, UserMinus, Users, Shield, Lock, Unlock } from 'lucide-react';
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
  created_at?: string;
  updated_at?: string;
};

// Type for a user profile
type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  isAdmin?: boolean;
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

  // Check if user has access to this work period
  const { isLoading: isCheckingAccess, error: accessError } = useQuery({
    queryKey: ['workPeriodAccess', id, user?.id, isAdmin],
    queryFn: async () => {
      // Admins have access to all work periods
      if (isAdmin) return true;
      
      if (!id || !user?.id) throw new Error('Work period ID and user ID are required');
      
      const { data, error } = await supabase
        .from('work_period_assignments')
        .select('*')
        .eq('work_period_id', id)
        .eq('user_id', user.id)
        .single();
        
      if (error) throw error;
      return !!data;
    },
    onSuccess: (data) => {
      if (!data) {
        // Redirect to home if user doesn't have access
        toast({
          title: 'Access denied',
          description: 'You do not have access to this work period.',
          variant: 'destructive'
        });
        navigate('/');
      }
    },
    onError: () => {
      // Redirect to home if user doesn't have access
      toast({
        title: 'Access denied',
        description: 'You do not have access to this work period.',
        variant: 'destructive'
      });
      navigate('/');
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
      
      // Fetch user profiles from profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Fetch admin status for each user
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds)
        .eq('role', 'admin');
        
      if (rolesError) throw rolesError;
      
      // Add isAdmin flag to each profile
      const profilesWithAdminStatus = (profiles || []).map(profile => ({
        ...profile,
        isAdmin: userRoles?.some(role => role.user_id === profile.id && role.role === 'admin') || false
      }));
      
      return profilesWithAdminStatus;
    }
  });

  // Fetch all users for the user management dialog
  const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery({
    queryKey: ['allUsers', isUserDialogOpen],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');
      
      if (profilesError) throw profilesError;
      
      // Fetch admin status for all users
      const userIds = profiles?.map(profile => profile.id) || [];
      
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds)
        .eq('role', 'admin');
        
      if (rolesError) throw rolesError;
      
      // Add isAdmin flag to each profile
      const profilesWithAdminStatus = (profiles || []).map(profile => ({
        ...profile,
        isAdmin: userRoles?.some(role => role.user_id === profile.id && role.role === 'admin') || false
      }));
      
      return profilesWithAdminStatus;
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

  // Toggle lock status for an entire column (date)
  const toggleColumnLock = async (dateKey: string) => {
    if (!isAdmin || !assignedUsers) return;
    
    // Check if the column is currently locked (if any cell is locked)
    const isColumnLocked = Object.keys(scheduleGrid).some(userId => 
      scheduleGrid[userId]?.[dateKey]?.locked
    );
    
    // Toggle lock state for all cells in the column
    const newLockState = !isColumnLocked;
    
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
          work_period_id: id!,
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
        if (newGrid[userId] && newGrid[userId][dateKey] && newGrid[userId][dateKey].assigned) {
          assignedCount++;
        }
      });
      
      // If we need more assignments
      if (assignedCount < workPeriod.needed_capacity) {
        // Sort users by total assigned shifts (ascending)
        const sortedUsers = [...userIds].sort((a, b) => {
          const aAssignments = Object.values(newGrid[a] || {})
            .filter(cell => cell && (cell as CellData).assigned).length;
          const bAssignments = Object.values(newGrid[b] || {})
            .filter(cell => cell && (cell as CellData).assigned).length;
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
            .filter(cell => cell && (cell as CellData).assigned).length;
          const bAssignments = Object.values(newGrid[b] || {})
            .filter(cell => cell && (cell as CellData).assigned).length;
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
    
    // Apply changes to the grid and save to database
    setScheduleGrid(newGrid);
    
    // Save all changes to the database
    const promises: Promise<any>[] = [];
    
    userIds.forEach(userId => {
      if (!newGrid[userId]) return;
      
      const days = differenceInDays(parseISO(workPeriod.end_date), parseISO(workPeriod.start_date)) + 1;
      
      for (let i = 0; i < days; i++) {
        const date = addDays(parseISO(workPeriod.start_date), i);
        const dateKey = format(date, 'yyyy-MM-dd');
        
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

  // Get count of assigned users for a date
  const getAssignedCountForDate = (dateKey: string) => {
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
  const isColumnLocked = (dateKey: string) => {
    if (!assignedUsers || !scheduleGrid) return false;
    
    return assignedUsers.every(user => 
      scheduleGrid[user.id]?.[dateKey]?.locked
    );
  };

  const handleAddUser = (userId: string) => {
    addUserMutation.mutate(userId);
  };

  const handleRemoveUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  const getUserDisplayName = (user: UserProfile) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.id;
  };

  // Loading state
  if (isLoadingWorkPeriod || isLoadingUsers || isLoadingShifts || isCheckingAccess) {
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
  if (workPeriodError || accessError) {
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
  const filteredUsers = allUsers 
    ? allUsers.filter(user => 
        (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];
  
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
            {isAdmin && (
              <TabsTrigger value="requests">Day-Off Requests</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="schedule" className="mt-6">
            {assignedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No users assigned to this work period yet.</p>
                {isAdmin && (
                  <Button onClick={() => setIsUserDialogOpen(true)}>Add Users</Button>
                )}
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
                          const assignedCount = getAssignedCountForDate(dateKey);
                          const isLocked = isColumnLocked(dateKey);
                          
                          return (
                            <th key={date.toString()} className="border bg-muted px-4 py-2 text-center" style={{ minWidth: '100px' }}>
                              <div className="flex justify-between items-center">
                                <span>{format(date, 'EEE')}</span>
                                {isAdmin && (
                                  <button 
                                    className="opacity-60 hover:opacity-100" 
                                    onClick={() => toggleColumnLock(dateKey)}
                                  >
                                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
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
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Assigned Users</h2>
              {isAdmin && (
                <Button onClick={() => setIsUserDialogOpen(true)}>Add Users</Button>
              )}
            </div>
            
            {assignedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No users assigned to this work period yet.</p>
                {isAdmin && (
                  <Button onClick={() => setIsUserDialogOpen(true)}>Add Users</Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedUsers.map(user => (
                  <Card key={user.id} className="shadow-sm">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback>{(user.first_name?.[0] || "") + (user.last_name?.[0] || "")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{getUserDisplayName(user)}</div>
                          <div className="flex gap-2 items-center">
                            {user.isAdmin ? (
                              <Badge variant="default" className="text-xs">Admin</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Regular</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="requests" className="mt-6">
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">Day-off request management coming soon.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      
      {/* Add users dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Users to Work Period</DialogTitle>
            <DialogDescription>
              Select users to add to this work period. Users will be able to see the work period and manage their availability.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Input 
              placeholder="Search users..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="mb-4"
            />
            
            <div className="max-h-96 overflow-y-auto">
              {isLoadingAllUsers ? (
                <div className="py-4 text-center">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-4 text-center">No users found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => {
                      const isInWorkPeriod = assignedUsers.some(
                        assignedUser => assignedUser.id === user.id
                      );
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{getUserDisplayName(user)}</TableCell>
                          <TableCell>
                            {user.isAdmin ? (
                              <Badge variant="default">Admin</Badge>
                            ) : (
                              <Badge variant="secondary">Regular</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isInWorkPeriod ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRemoveUser(user.id)}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleAddUser(user.id)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsUserDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default WorkPeriodDetail;
