
import { useState } from "react";
import Layout from "../components/Layout";
import WorkPeriodList from "../components/WorkPeriodList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mock function - would be replaced with Supabase auth
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">Shift Manager</h1>
            <p className="mt-2 text-gray-600">
              Efficiently manage work periods and schedules
            </p>
          </div>
          
          <Alert className="my-6">
            <AlertTitle>Supabase Integration Required</AlertTitle>
            <AlertDescription>
              Authentication requires Supabase integration. For now, click the button below to bypass login.
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={handleLogin}
            className="w-full" 
            size="lg"
          >
            Continue to App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Shift Manager</h1>
        
        <Tabs defaultValue="work-periods">
          <TabsList className="mb-6">
            <TabsTrigger value="work-periods">Work Periods</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          
          <TabsContent value="work-periods">
            <WorkPeriodList />
          </TabsContent>
          
          <TabsContent value="users">
            <p className="text-muted-foreground">User management functionality would be implemented here.</p>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
