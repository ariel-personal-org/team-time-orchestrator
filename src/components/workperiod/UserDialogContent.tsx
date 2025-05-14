
import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, UserRound } from 'lucide-react';
import { UserProfile } from '@/types/scheduleTypes';
import { Input } from '@/components/ui/input';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('UserDialogContent received allUsers:', allUsers?.length);
    console.log('UserDialogContent received assignedUsers:', assignedUsers?.length);
  }, [allUsers, assignedUsers]);

  // Filter users based on search term
  const filteredUsers = allUsers
    ? allUsers.filter(user => 
        (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];
    
  console.log('Filtered users count:', filteredUsers.length);
  console.log('Filtered user IDs:', filteredUsers.map(u => u.id).join(', '));

  // Function to create a test user for demonstration
  const createTestUser = async () => {
    try {
      setIsCreatingUser(true);
      
      // Generate a random ID for the test user
      const testUserId = crypto.randomUUID();
      
      // Create a profile for the test user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: testUserId,
          first_name: 'Test',
          last_name: `User ${Math.floor(Math.random() * 1000)}`
        }])
        .select();
      
      if (profileError) {
        throw profileError;
      }
      
      // Add regular user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: testUserId,
          role: 'user'
        }]);
      
      if (roleError) {
        throw roleError;
      }
      
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
      <div className="flex items-center justify-between mb-4">
        <Input 
          placeholder="Search users..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="flex-1 mr-2"
        />
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
