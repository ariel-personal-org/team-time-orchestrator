
import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import CreateWorkPeriodDialog from './CreateWorkPeriodDialog';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

// Define our work period type
export type WorkPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  needed_capacity: number;
  users?: string[];
  userCount?: number;
};

const WorkPeriodList: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch work periods from Supabase
  const { data: workPeriods, isLoading, error } = useQuery({
    queryKey: ['workPeriods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_periods')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      // Get user count for each work period
      const periodsWithUserCounts = await Promise.all(data.map(async (period) => {
        const { count, error: countError } = await supabase
          .from('work_period_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('work_period_id', period.id);
          
        return {
          ...period,
          userCount: count || 0
        };
      }));
      
      return periodsWithUserCounts;
    }
  });

  // Create work period mutation
  const createWorkPeriod = useMutation({
    mutationFn: async (newWorkPeriod: Omit<WorkPeriod, 'id'>) => {
      const { data, error } = await supabase
        .from('work_periods')
        .insert([newWorkPeriod])
        .select();
        
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workPeriods'] });
      toast({
        title: 'Work Period Created',
        description: 'The work period has been successfully created.',
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error Creating Work Period',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleCreateWorkPeriod = (newWorkPeriod: Omit<WorkPeriod, 'id'>) => {
    createWorkPeriod.mutate(newWorkPeriod);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Work Periods</h2>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create Work Period
          </Button>
        </div>
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error loading work periods: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Work Periods</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create Work Period
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workPeriods && workPeriods.length > 0 ? (
            workPeriods.map((period) => (
              <Card key={period.id}>
                <CardHeader>
                  <CardTitle>{period.name}</CardTitle>
                  <CardDescription>
                    {format(parseISO(period.start_date), 'MMM d, yyyy')} - {format(parseISO(period.end_date), 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><span className="font-medium">Needed Capacity:</span> {period.needed_capacity} users per shift</p>
                    <p><span className="font-medium">Users Assigned:</span> {period.userCount || 0}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/work-period/${period.id}`}>View Details</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No work periods found. Create one to get started.</p>
            </div>
          )}
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
