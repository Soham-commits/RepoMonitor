"use client";

import { useState, useEffect } from "react";
import { RepoInput } from "@/src/components/RepoInput";
import { Dashboard } from "@/src/components/Dashboard";
import { auth, UserProfile } from "@/src/utils/auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SetupPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }

    if (user.profile) {
      setProfile(user.profile);
    }
    setIsLoading(false);
  }, [router]);

  const handleStartMonitoring = (repos: string[], pat: string) => {
    auth.saveProfile(pat, repos);
    setProfile({ email: auth.getCurrentUserEmail() || "", repos, pat, isAdmin: auth.getCurrentUser()?.isAdmin || false });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (profile) {
    return <Dashboard repos={profile.repos} pat={profile.pat} />;
  }

  return (
    <RepoInput 
      onStart={handleStartMonitoring} 
    />
  );
}
