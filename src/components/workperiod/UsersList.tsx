
import React from 'react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserProfile } from '@/types/scheduleTypes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import UserCard from './UserCard';
import UserDialogContent from './UserDialogContent';

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
  const {
    allUsers,
    isLoadingAllUsers,
    isUserDialogOpen,
    setIsUserDialogOpen,
    handleAddUser,
    handleRemoveUser
  } = useUserManagement(workPeriodId, refetchAssignedUsers);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Allocated Users</h2>
        {isAdmin && (
          <Button onClick={() => setIsUserDialogOpen(true)}>Allocate Users</Button>
        )}
      </div>
      
      {assignedUsers.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No users allocated to this work period yet.</p>
          {isAdmin && (
            <Button onClick={() => setIsUserDialogOpen(true)}>Allocate Users</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedUsers.map(user => (
            <UserCard 
              key={user.id}
              user={user}
              isAdmin={isAdmin}
              onRemoveUser={handleRemoveUser}
            />
          ))}
        </div>
      )}

      {/* Allocate users dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Users to Work Period</DialogTitle>
            <DialogDescription>
              Select users to allocate to this work period. Users will be able to see the work period and manage their availability.
            </DialogDescription>
          </DialogHeader>
          
          <UserDialogContent
            allUsers={allUsers}
            assignedUsers={assignedUsers}
            isLoading={isLoadingAllUsers}
            onAddUser={handleAddUser}
            onRemoveUser={handleRemoveUser}
          />
          
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
