
import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, UserRound } from 'lucide-react';
import { UserProfile } from '@/types/scheduleTypes';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getUserDisplayName } from '@/utils/scheduleUtils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface UserDialogContentProps {
  allUsers: UserProfile[];
  assignedUsers: UserProfile[];
  isLoading: boolean;
  onAddUser: (userId: string) => void;
  onRemoveUser: (userId: string) => void;
}

const UserDialogContent: React.FC<UserDialogContentProps> = ({
  allUsers,
  assignedUsers,
  isLoading,
  onAddUser,
  onRemoveUser
}) => {
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('UserDialogContent received allUsers:', allUsers?.length);
    console.log('UserDialogContent received assignedUsers:', assignedUsers?.length);
  }, [allUsers, assignedUsers]);

  // Function to create a test user for demonstration
  const createTestUser = async () => {
    try {
      setIsCreatingUser(true);
      
      // Generate a random ID for the test user
      const testUserId = crypto.randomUUID();
      
      // Create a profile for the test user with detailed logging
      console.log('Creating test user with ID:', testUserId);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: testUserId,
          first_name: 'Test',
          last_name: `User ${Math.floor(Math.random() * 1000)}`
        }])
        .select();
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }
      
      console.log('Profile created successfully:', profile);
      
      // Add regular user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: testUserId,
          role: 'user'
        }])
        .select();
      
      if (roleError) {
        console.error('Role assignment error:', roleError);
        throw roleError;
      }
      
      console.log('User role assigned successfully:', roleData);
      
      toast({
        title: 'Test user created',
        description: 'A new test user has been created for demonstration purposes.',
      });
      
      // Wait 1 second and then reload the current page to refresh the users list
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error creating test user:', error);
      toast({
        title: 'Error creating test user',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-end mb-4">
        <Button 
          onClick={createTestUser} 
          disabled={isCreatingUser} 
          variant="outline"
          size="sm"
        >
          <UserRound className="h-4 w-4 mr-2" />
          Create Test User
        </Button>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="py-4 text-center">Loading users...</div>
        ) : allUsers.length === 0 ? (
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
              {allUsers.map(user => {
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
                          onClick={() => onRemoveUser(user.id)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onAddUser(user.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Allocate
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
  );
};

export default UserDialogContent;
