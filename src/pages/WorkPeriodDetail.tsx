
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import Layout from '../components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { WorkPeriod } from '../components/WorkPeriodList';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { ScheduleGrid as ScheduleGridType } from '@/types/scheduleTypes';
import { initializeScheduleGrid, getDates } from '@/utils/scheduleUtils';
import ScheduleGridComponent from '@/components/workperiod/ScheduleGrid';
import UsersList from '@/components/workperiod/UsersList';
import StatsCards from '@/components/workperiod/StatsCards';
import EditWorkPeriodDialog from '@/components/workperiod/EditWorkPeriodDialog';

const WorkPeriodDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [scheduleGrid, setScheduleGrid] = useState<ScheduleGridType>({});
  const [selectedTab, setSelectedTab] = useState('schedule');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
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
  const { isLoading: isCheckingAccess } = useQuery({
    queryKey: ['workPeriodAccess', id, user?.id, isAdmin],
    queryFn: async () => {
      // Admins have access to all work periods
      if (isAdmin) return true;
      
      if (!id || !user?.id) throw new Error('Work period ID and user ID are required');
      
      // Use the string version of the table name to avoid TypeScript errors
      const { data, error } = await supabase
        .from('work_period_users')
        .select('*')
        .eq('work_period_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return !!data;
    },
    meta: {
      onError: (error) => {
        // Redirect to home if user doesn't have access
        toast({
          title: 'Access denied',
          description: 'You do not have access to this work period.',
          variant: 'destructive'
        });
        navigate('/');
      }
    }
  });

  // Fetch users allocated to this work period
  const { data: assignedUsers, isLoading: isLoadingUsers, refetch: refetchAssignedUsers } = useQuery({
    queryKey: ['workPeriodUsers', id],
    queryFn: async () => {
      if (!id) throw new Error('Work period ID is required');
      
      // Use the string version of the table name to avoid TypeScript errors
      const { data: allocations, error: allocationsError } = await supabase
        .from('work_period_users')
        .select('user_id')
        .eq('work_period_id', id);
        
      if (allocationsError) throw allocationsError;
      
      // If there are no allocations, return empty array
      if (!allocations || allocations.length === 0) return [];
      
      // Get user profiles for each assigned user
      const userIds = allocations.map(allocation => allocation.user_id);
      
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
      return data;
    },
    enabled: !!id
  });

  // Initialize the schedule grid when data is loaded
  useEffect(() => {
    if (workPeriod && assignedUsers && shifts) {
      const grid = initializeScheduleGrid(workPeriod, assignedUsers, shifts);
      setScheduleGrid(grid);
    }
  }, [workPeriod, assignedUsers, shifts]);

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

  const dates = getDates(workPeriod);
  
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
            <Button onClick={() => setIsEditDialogOpen(true)}>Edit Work Period</Button>
          )}
        </div>

        {/* Stats Cards */}
        <StatsCards 
          workPeriod={workPeriod}
          assignedUsers={assignedUsers}
          shifts={shifts || []}
          datesLength={dates.length}
        />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6 w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="schedule" className="flex-1 text-base py-3">Schedule</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 text-base py-3">
              Users
              <Badge variant="secondary" className="ml-2">{assignedUsers.length}</Badge>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="requests" className="flex-1 text-base py-3">Day-Off Requests</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="schedule" className="mt-6">
            <ScheduleGridComponent
              workPeriodId={id!}
              workPeriod={workPeriod}
              assignedUsers={assignedUsers}
              scheduleGrid={scheduleGrid}
              setScheduleGrid={setScheduleGrid}
              isAdmin={isAdmin}
            />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <UsersList
              workPeriodId={id!}
              assignedUsers={assignedUsers}
              isAdmin={isAdmin}
              refetchAssignedUsers={refetchAssignedUsers}
            />
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="requests" className="mt-6">
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">Day-off request management coming soon.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
        
        {/* Edit Work Period Dialog */}
        {workPeriod && (
          <EditWorkPeriodDialog 
            open={isEditDialogOpen} 
            onOpenChange={setIsEditDialogOpen} 
            workPeriod={workPeriod} 
          />
        )}
      </div>
    </Layout>
  );
};

export default WorkPeriodDetail;
