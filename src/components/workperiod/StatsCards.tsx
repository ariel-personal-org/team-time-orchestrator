
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WorkPeriod } from '@/components/WorkPeriodList';
import { UserProfile, ShiftRecord } from '@/types/scheduleTypes';

interface StatsCardsProps {
  workPeriod: WorkPeriod;
  assignedUsers: UserProfile[];
  shifts: ShiftRecord[] | undefined;
  datesLength: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({ workPeriod, assignedUsers, shifts, datesLength }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Needed Capacity</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-bold">{workPeriod.needed_capacity}</div>
          <p className="text-xs text-muted-foreground">Users per shift</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Users Assigned</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-bold">{assignedUsers.length}</div>
          <p className="text-xs text-muted-foreground">Total users</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-bold">{datesLength}</div>
          <p className="text-xs text-muted-foreground">Days in period</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Days-Off Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-bold">
            {shifts ? shifts.filter(shift => shift.requested_off).length : 0}
          </div>
          <p className="text-xs text-muted-foreground">Pending requests</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
