"use client";

import { useState } from "react";
import { RepoInput } from "@/src/components/RepoInput";
import { Dashboard } from "@/src/components/Dashboard";

export default function SetupPage() {
  const [monitorData, setMonitorData] = useState<{ repos: string[]; pat: string } | null>(null);

  if (monitorData) {
    return <Dashboard repos={monitorData.repos} pat={monitorData.pat} />;
  }

  return (
    <RepoInput 
      onStart={(repos, pat) => {
        setMonitorData({ repos, pat });
      }} 
    />
  );
}
