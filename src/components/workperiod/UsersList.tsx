
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/scheduleTypes';
import { Button } from '@/components/ui/button';
import { Loader, UserPlus, UserMinus } from 'lucide-react';
import UserCard from './UserCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getUserDisplayName } from '@/utils/scheduleUtils';

interface UsersListProps {
  workPeriodId: string;
  assignedUsers: UserProfile[];
  isAdmin: boolean;
  refetchAssignedUsers: () => void;
}

const UsersList: React.FC<UsersListProps> = ({ 
  workPeriodId, 
  assignedUsers, 
  isAdmin, 
  refetchAssignedUsers 
}) => {
  // Fetch all users
  const { data: allUsers = [], isLoading: isLoadingAllUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      console.log('Fetching all users from profiles table...');
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }
      
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
      
      return profilesWithAdminStatus;
    }
  });

  // Handle adding a user to work period
  const handleAddUser = async (userId: string) => {
    try {
      console.log(`Adding user ${userId} to work period ${workPeriodId}`);
      const { error } = await supabase
        .from('work_period_users')
        .insert([{ work_period_id: workPeriodId, user_id: userId }]);
      
      if (error) throw error;
      refetchAssignedUsers();
    } catch (error) {
      console.error('Error allocating user:', error);
    }
  };

  // Handle removing a user from work period
  const handleRemoveUser = async (userId: string) => {
    try {
      console.log(`Removing user ${userId} from work period ${workPeriodId}`);
      const { error } = await supabase
        .from('work_period_users')
        .delete()
        .eq('work_period_id', workPeriodId)
        .eq('user_id', userId);
      
      if (error) throw error;
      refetchAssignedUsers();
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  // Create test user function
  const createTestUser = async () => {
    try {
      // Generate a random user ID (this would normally come from auth)
      const userId = crypto.randomUUID();
      console.log('Creating test user with ID:', userId);
      
      // Create the user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([
          { 
            id: userId, 
            first_name: `Test ${Math.floor(Math.random() * 1000)}`, 
            last_name: `User ${Math.floor(Math.random() * 1000)}`
          }
        ])
        .select();
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }
      
      // Create user role (as a regular user)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([
          { user_id: userId, role: 'user' }
        ]);
      
      if (roleError) {
        console.error('Role creation error:', roleError);
        throw roleError;
      }
      
      console.log('Test user created successfully');
      // Refetch the users list
      document.location.reload();
    } catch (error) {
      console.error('Error creating test user:', error);
    }
  };

  // Check if a user is allocated to this work period
  const isUserAllocated = (userId: string) => {
    return assignedUsers.some(user => user.id === userId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Users</h2>
        {isAdmin && (
          <Button onClick={createTestUser} variant="outline" size="sm">
            Create Test User
          </Button>
        )}
      </div>
      
      {isLoadingAllUsers ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading users...</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              allUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>{(user.first_name?.[0] || "") + (user.last_name?.[0] || "")}</AvatarFallback>
                    </Avatar>
                    <span>{getUserDisplayName(user)}</span>
                  </TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <Badge variant="default" className="text-xs">Admin</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Regular</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {isUserAllocated(user.id) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                          <span className="sr-only">Remove user</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddUser(user.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                          <span className="sr-only">Add user</span>
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default UsersList;
