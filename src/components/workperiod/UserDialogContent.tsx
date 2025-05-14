
import React, { useState } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';
import { UserProfile } from '@/types/scheduleTypes';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getUserDisplayName } from '@/utils/scheduleUtils';

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

  // Filter users based on search term
  const filteredUsers = allUsers
    ? allUsers.filter(user => 
        (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  return (
    <div className="py-4">
      <Input 
        placeholder="Search users..." 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
        className="mb-4"
      />
      
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
