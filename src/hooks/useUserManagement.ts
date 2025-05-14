
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
      console.log('Fetching all users...');
      
      // Fetch all profiles from the profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('Fetched profiles:', profiles?.length);
      
      // Fetch admin status for all users
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');
        
      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }
      
      // Add isAdmin flag to each profile
      const profilesWithAdminStatus = (profiles || []).map(profile => ({
        ...profile,
        isAdmin: userRoles?.some(role => role.user_id === profile.id && role.role === 'admin') || false
      }));
      
      console.log('Profiles with admin status:', profilesWithAdminStatus.length);
      return profilesWithAdminStatus;
    },
    enabled: true
  });

  // Mutation for adding a user to a work period
  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Use the string version of the table name to avoid TypeScript errors
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
      // Delete both allocation and shifts for this user in this work period
      // Use the string version of the table name to avoid TypeScript errors
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
