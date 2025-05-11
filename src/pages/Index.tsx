
import { useState } from "react";
import Layout from "../components/Layout";
import WorkPeriodList from "../components/WorkPeriodList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/providers/AuthProvider";

const Index = () => {
  const { isAdmin } = useAuth();

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Shift Manager</h1>
        
        <Tabs defaultValue="work-periods">
          <TabsList className="mb-6">
            <TabsTrigger value="work-periods">Work Periods</TabsTrigger>
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="work-periods">
            <WorkPeriodList />
          </TabsContent>
          
          <TabsContent value="users">
            {isAdmin ? (
              <p className="text-muted-foreground">User management functionality would be implemented here.</p>
            ) : (
              <p className="text-muted-foreground">You don't have permission to access this section.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
