
import { useState } from "react";
import Layout from "../components/Layout";
import WorkPeriodList from "../components/WorkPeriodList";
import { useAuth } from "@/providers/AuthProvider";

const Index = () => {
  const { isAdmin } = useAuth();

  return (
    <Layout>
      <div className="container py-6">
        <WorkPeriodList />
      </div>
    </Layout>
  );
};

export default Index;
