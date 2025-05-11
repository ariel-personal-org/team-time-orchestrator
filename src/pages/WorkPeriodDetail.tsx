
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays, differenceInDays } from 'date-fns';
import Layout from '../components/Layout';
import { WorkPeriod } from '../components/WorkPeriodList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock } from 'lucide-react';

// Mock users data - would come from Supabase in a real implementation
const mockUsers = [
  { id: '1', name: 'User 1', role: 'worker' },
  { id: '2', name: 'User 2', role: 'worker' },
  { id: '3', name: 'User 3', role: 'worker' },
  { id: '4', name: 'User 4', role: 'worker' },
  { id: '5', name: 'User 5', role: 'worker' },
  { id: '6', name: 'User 6', role: 'worker' },
];

// Mock work periods data - would come from Supabase in a real implementation
const mockWorkPeriods: WorkPeriod[] = [
  {
    id: '1',
    name: 'October Cool Shifts',
    startDate: new Date(2023, 9, 1),
    endDate: new Date(2023, 9, 10), // 10 days for simplicity
    neededCapacity: 3,
    users: ['1', '2', '3', '4', '5']
  },
  {
    id: '2',
    name: 'November Schedule',
    startDate: new Date(2023, 10, 1),
    endDate: new Date(2023, 10, 10),
    neededCapacity: 2,
    users: ['1', '3', '5', '6']
  }
];

// Type for our cell data in the schedule
type CellData = {
  assigned: boolean;
  locked: boolean;
  requested: boolean;
};

// Initialize an empty schedule grid
const initializeScheduleGrid = (workPeriod: WorkPeriod) => {
  const days = differenceInDays(workPeriod.endDate, workPeriod.startDate) + 1;
  const grid: Record<string, Record<string, CellData>> = {};
  
  workPeriod.users.forEach(userId => {
    grid[userId] = {};
    for (let i = 0; i < days; i++) {
      grid[userId][format(addDays(workPeriod.startDate, i), 'yyyy-MM-dd')] = {
        assigned: Math.random() > 0.5, // Random initial assignments for demo
        locked: false,
        requested: Math.random() > 0.8, // Some random day-off requests for demo
      };
    }
  });
  
  return grid;
};

const WorkPeriodDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [workPeriod, setWorkPeriod] = useState<WorkPeriod | null>(null);
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, Record<string, CellData>>>({});
  const [isAdmin, setIsAdmin] = useState(true); // For demo purposes, hardcoded as admin

  useEffect(() => {
    // Fetch work period from mock data (would be Supabase in real implementation)
    const period = mockWorkPeriods.find(p => p.id === id);
    if (period) {
      setWorkPeriod(period);
      setScheduleGrid(initializeScheduleGrid(period));
    }
  }, [id]);

  if (!workPeriod) {
    return (
      <Layout>
        <div className="container py-6">
          <Alert>
            <AlertTitle>Work period not found</AlertTitle>
            <AlertDescription>
              The requested work period could not be found.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  // Generate date headers for the schedule
  const getDates = () => {
    const dates = [];
    const days = differenceInDays(workPeriod.endDate, workPeriod.startDate) + 1;
    
    for (let i = 0; i < days; i++) {
      const date = addDays(workPeriod.startDate, i);
      dates.push(date);
    }
    
    return dates;
  };

  // Toggle cell assignment status
  const toggleAssignment = (userId: string, dateKey: string) => {
    if (!isAdmin) return;
    
    setScheduleGrid(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [dateKey]: {
          ...prev[userId][dateKey],
          assigned: !prev[userId][dateKey].assigned,
        }
      }
    }));
  };

  // Toggle cell lock status
  const toggleLock = (userId: string, dateKey: string) => {
    if (!isAdmin) return;
    
    setScheduleGrid(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [dateKey]: {
          ...prev[userId][dateKey],
          locked: !prev[userId][dateKey].locked,
        }
      }
    }));
  };

  // Run optimizer (mock implementation)
  const runOptimizer = () => {
    // In a real implementation, this would call a backend service
    // For now, we'll just assign shifts to meet capacity requirements
    // without changing locked cells
    
    const newGrid = { ...scheduleGrid };
    const dates = getDates();
    const usersArray = workPeriod.users;
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      let assignedCount = 0;
      
      // Count current assignments for this date
      usersArray.forEach(userId => {
        if (newGrid[userId][dateKey].assigned) {
          assignedCount++;
        }
      });
      
      // If we need more assignments, add them
      if (assignedCount < workPeriod.neededCapacity) {
        // Sort users by number of assigned shifts (ascending)
        const sortedUsers = [...usersArray].sort((a, b) => {
          const aAssignments = Object.values(newGrid[a]).filter(cell => cell.assigned).length;
          const bAssignments = Object.values(newGrid[b]).filter(cell => cell.assigned).length;
          return aAssignments - bAssignments;
        });
        
        // Assign shifts to users with fewer shifts until capacity is met
        for (const userId of sortedUsers) {
          const cellData = newGrid[userId][dateKey];
          
          // Skip if already assigned or locked or requested off
          if (cellData.assigned || cellData.locked || cellData.requested) {
            continue;
          }
          
          // Assign shift
          newGrid[userId][dateKey] = {
            ...cellData,
            assigned: true
          };
          
          assignedCount++;
          if (assignedCount >= workPeriod.neededCapacity) {
            break;
          }
        }
      }
      // If we have too many assignments, remove some
      else if (assignedCount > workPeriod.neededCapacity) {
        // Sort users by number of assigned shifts (descending)
        const sortedUsers = [...usersArray].sort((a, b) => {
          const aAssignments = Object.values(newGrid[a]).filter(cell => cell.assigned).length;
          const bAssignments = Object.values(newGrid[b]).filter(cell => cell.assigned).length;
          return bAssignments - aAssignments;
        });
        
        // Remove shifts from users with more shifts until capacity is met
        for (const userId of sortedUsers) {
          const cellData = newGrid[userId][dateKey];
          
          // Skip if locked
          if (cellData.locked) {
            continue;
          }
          
          // Unassign shift
          if (cellData.assigned) {
            newGrid[userId][dateKey] = {
              ...cellData,
              assigned: false
            };
            
            assignedCount--;
            if (assignedCount <= workPeriod.neededCapacity) {
              break;
            }
          }
        }
      }
    });
    
    setScheduleGrid(newGrid);
  };

  const dates = getDates();
  
  return (
    <Layout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">{workPeriod.name}</h1>
            <p className="text-muted-foreground">
              {format(workPeriod.startDate, 'MMMM d, yyyy')} - {format(workPeriod.endDate, 'MMMM d, yyyy')}
            </p>
          </div>
          <Button onClick={() => {}}>Edit Work Period</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Needed Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workPeriod.neededCapacity}</div>
              <p className="text-xs text-muted-foreground">Users per shift</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Users Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workPeriod.users.length}</div>
              <p className="text-xs text-muted-foreground">Total users</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dates.length}</div>
              <p className="text-xs text-muted-foreground">Days in period</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Days-Off Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(scheduleGrid).reduce((count, userShifts) => 
                  count + Object.values(userShifts).filter(cell => cell.requested).length, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="schedule" className="mb-6">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Day-Off Requests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedule" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-shift-assigned rounded mr-1"></div>
                  <span className="text-sm">Assigned</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-shift-unassigned rounded mr-1"></div>
                  <span className="text-sm">Unassigned</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-shift-requested rounded mr-1"></div>
                  <span className="text-sm">Day-off Requested</span>
                </div>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  <span className="text-sm">Locked</span>
                </div>
              </div>
              
              {isAdmin && (
                <Button onClick={runOptimizer}>Optimize Schedule</Button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border bg-muted px-4 py-2 text-left">User</th>
                    {dates.map((date) => (
                      <th key={date.toString()} className="border bg-muted px-4 py-2 text-center" style={{ minWidth: '100px' }}>
                        <div>{format(date, 'EEE')}</div>
                        <div className="text-xs">{format(date, 'MMM d')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workPeriod.users.map((userId) => {
                    const user = mockUsers.find(u => u.id === userId);
                    return (
                      <tr key={userId}>
                        <td className="border px-4 py-2">{user?.name || userId}</td>
                        {dates.map((date) => {
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const cellData = scheduleGrid[userId]?.[dateKey] || { assigned: false, locked: false, requested: false };
                          
                          // Determine cell background color
                          let bgColor = '';
                          if (cellData.assigned) {
                            bgColor = 'bg-shift-assigned bg-opacity-70';
                          } else {
                            bgColor = 'bg-shift-unassigned bg-opacity-70';
                          }
                          
                          if (cellData.requested) {
                            bgColor = 'bg-shift-requested bg-opacity-70';
                          }
                          
                          return (
                            <td 
                              key={dateKey} 
                              className={`border px-1 py-1 text-center relative cursor-pointer ${bgColor}`}
                              onClick={() => toggleAssignment(userId, dateKey)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                toggleLock(userId, dateKey);
                              }}
                            >
                              <div className="flex justify-center items-center h-10">
                                {cellData.assigned ? 'Working' : 'Off'}
                                {cellData.locked && (
                                  <Lock className="absolute top-1 right-1 w-3 h-3" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              {isAdmin ? 'Right-click to lock/unlock a cell. Locked cells will not be modified by the optimizer.' : ''}
            </p>
          </TabsContent>
          
          <TabsContent value="users">
            <p className="text-muted-foreground">User management would be implemented here.</p>
          </TabsContent>
          
          <TabsContent value="requests">
            <p className="text-muted-foreground">Day-off requests management would be implemented here.</p>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default WorkPeriodDetail;
