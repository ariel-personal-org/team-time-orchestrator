
import React from "react";
import Layout from "../components/Layout";
import WorkPeriodList from "../components/WorkPeriodList";

const Index = () => {
  return (
    <Layout>
      <div className="container py-6">
        <WorkPeriodList />
      </div>
    </Layout>
  );
};

export default Index;
