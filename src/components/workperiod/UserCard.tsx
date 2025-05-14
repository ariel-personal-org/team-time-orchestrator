
import React from 'react';
import { UserMinus } from 'lucide-react';
import { UserProfile } from '@/types/scheduleTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getUserDisplayName } from '@/utils/scheduleUtils';

interface UserCardProps {
  user: UserProfile;
  isAdmin: boolean;
  onRemoveUser: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, isAdmin, onRemoveUser }) => {
  return (
    <Card className="shadow-sm">
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
            onClick={() => onRemoveUser(user.id)}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default UserCard;
