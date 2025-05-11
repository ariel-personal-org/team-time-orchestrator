
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import CreateWorkPeriodDialog from './CreateWorkPeriodDialog';
import { Link } from 'react-router-dom';

// Define our work period type
export type WorkPeriod = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  neededCapacity: number;
  users: string[];
};

const WorkPeriodList: React.FC = () => {
  // Mock data - would come from Supabase in a real implementation
  const [workPeriods, setWorkPeriods] = useState<WorkPeriod[]>([
    {
      id: '1',
      name: 'October Cool Shifts',
      startDate: new Date(2023, 9, 1),
      endDate: new Date(2023, 9, 31),
      neededCapacity: 10,
      users: ['User 1', 'User 2', 'User 3', 'User 4', 'User 5']
    },
    {
      id: '2',
      name: 'November Schedule',
      startDate: new Date(2023, 10, 1),
      endDate: new Date(2023, 10, 30),
      neededCapacity: 8,
      users: ['User 1', 'User 3', 'User 5', 'User 6']
    }
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateWorkPeriod = (newWorkPeriod: Omit<WorkPeriod, 'id'>) => {
    const workPeriodWithId = {
      ...newWorkPeriod,
      id: Math.random().toString(36).substr(2, 9) // Generate a random ID
    };
    
    setWorkPeriods([...workPeriods, workPeriodWithId]);
    setIsCreateDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Work Periods</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create Work Period
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workPeriods.map((period) => (
          <Card key={period.id}>
            <CardHeader>
              <CardTitle>{period.name}</CardTitle>
              <CardDescription>
                {format(period.startDate, 'MMM d, yyyy')} - {format(period.endDate, 'MMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><span className="font-medium">Needed Capacity:</span> {period.neededCapacity} users per shift</p>
                <p><span className="font-medium">Users Assigned:</span> {period.users.length}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full">
                <Link to={`/work-period/${period.id}`}>View Details</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {workPeriods.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No work periods found. Create one to get started.</p>
        </div>
      )}

      <CreateWorkPeriodDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateWorkPeriod}
      />
    </div>
  );
};

export default WorkPeriodList;
