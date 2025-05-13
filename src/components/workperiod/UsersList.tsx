
import React, { useState } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/scheduleTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { getUserDisplayName } from '@/utils/scheduleUtils';

interface UsersListProps {
  workPeriodId: string;
  assignedUsers: UserProfile[];
  isAdmin: boolean;
  refetchAssignedUsers: () => void;
}

const UsersList: React.FC<UsersListProps> = ({ workPeriodId, assignedUsers, isAdmin, refetchAssignedUsers }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all users for the user management dialog - this is the key change
  const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery({
    queryKey: ['allUsers', isUserDialogOpen],
    queryFn: async () => {
      // Fetch all profiles regardless of work period assignment
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

  // Mutation for adding a user to a work period
  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('work_period_assignments')
        .insert([{ work_period_id: workPeriodId, user_id: userId }])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriodUsers', workPeriodId] });
      toast({
        title: 'User added',
        description: 'User has been added to the work period.',
      });
      refetchAssignedUsers();
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
        .eq('work_period_id', workPeriodId)
        .eq('user_id', userId);
      
      if (assignmentError) throw assignmentError;
      
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

  // Make sure we have data before filtering
  const filteredUsers = allUsers 
    ? allUsers.filter(user => 
        (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  return (
    <>
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
    </>
  );
};

export default UsersList;
