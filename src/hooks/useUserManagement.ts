
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/scheduleTypes';
import { useToast } from '@/components/ui/use-toast';

export function useUserManagement(workPeriodId: string, refetchAssignedUsers: () => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  // Fetch all users for the user management dialog
  const { data: allUsers = [], isLoading: isLoadingAllUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      console.log('Fetching all users from profiles table...');
      
      // Fetch all profiles
      const { data: profiles, error: profilesError, count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' });
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log(`Fetched ${profilesCount} profiles:`, profiles?.length);
      console.log('Profile IDs:', profiles?.map(p => p.id).join(', '));
      
      // Fetch admin status for all users
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');
        
      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }
      
      console.log('Fetched user roles:', userRoles?.length);
      console.log('Admin user IDs:', userRoles?.map(r => r.user_id).join(', '));
      
      // Add isAdmin flag to each profile
      const profilesWithAdminStatus = (profiles || []).map(profile => ({
        ...profile,
        isAdmin: userRoles?.some(role => role.user_id === profile.id && role.role === 'admin') || false
      }));
      
      console.log('Processed profiles with admin status:', profilesWithAdminStatus.length);
      return profilesWithAdminStatus;
    },
    enabled: true,
    refetchOnWindowFocus: false
  });

  // Mutation for adding a user to a work period
  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log(`Adding user ${userId} to work period ${workPeriodId}`);
      const { data, error } = await supabase
        .from('work_period_users')
        .insert([{ work_period_id: workPeriodId, user_id: userId }])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodUsers', workPeriodId] });
      toast({
        title: 'User allocated',
        description: 'User has been allocated to the work period.',
      });
      refetchAssignedUsers();
    },
    onError: (error) => {
      console.error('Error allocating user:', error);
      toast({
        title: 'Error allocating user',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation for removing a user from a work period
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log(`Removing user ${userId} from work period ${workPeriodId}`);
      const { error: allocationError } = await supabase
        .from('work_period_users')
        .delete()
        .eq('work_period_id', workPeriodId)
        .eq('user_id', userId);
      
      if (allocationError) throw allocationError;
      
      // Also delete shifts for this user in this work period
      const { error: shiftsError } = await supabase
        .from('shifts')
        .delete()
        .eq('work_period_id', workPeriodId)
        .eq('user_id', userId);
      
      if (shiftsError) throw shiftsError;
      
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodUsers', workPeriodId] });
      queryClient.invalidateQueries({ queryKey: ['workPeriodShifts', workPeriodId] });
      toast({
        title: 'User removed',
        description: 'User has been removed from the work period.',
      });
      refetchAssignedUsers();
    },
    onError: (error) => {
      console.error('Error removing user:', error);
      toast({
        title: 'Error removing user',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleAddUser = (userId: string) => {
    addUserMutation.mutate(userId);
  };

  const handleRemoveUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  return {
    allUsers,
    isLoadingAllUsers,
    isUserDialogOpen,
    setIsUserDialogOpen,
    handleAddUser,
    handleRemoveUser
  };
}
