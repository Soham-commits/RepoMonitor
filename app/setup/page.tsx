"use client";

import { useState, useEffect } from "react";
import { RepoInput } from "@/src/components/RepoInput";
import { Dashboard } from "@/src/components/Dashboard";
import { auth, TeamProfile, UserProfile } from "@/src/utils/auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";

export default function SetupPage() {
  const currentUser = typeof window !== "undefined" ? auth.getCurrentUser() : null;
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return auth.getCurrentUser()?.profile || null;
  });
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
    }
  }, [currentUser, router]);

  const handleStartMonitoring = (repos: string[], pat: string, teams?: TeamProfile[]) => {
    auth.saveProfile(pat, repos, teams);
    setProfile({ email: auth.getCurrentUserEmail() || "", repos, pat, teams, isAdmin: auth.getCurrentUser()?.isAdmin || false });
  };

  if (!currentUser) {
    return (
      <>
        <VideoBackground />
        <div className="min-h-screen bg-[#02020A] flex items-center justify-center relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E2CFF]" />
        </div>
      </>
    );
  }

  if (profile) {
    return (
      <>
        <VideoBackground />
        <div className="relative z-10">
          <Dashboard repos={profile.repos} pat={profile.pat} teams={profile.teams} />
        </div>
      </>
    );
  }

  return (
    <>
      <VideoBackground />
      <div className="relative z-10">
        <RepoInput
          onStart={handleStartMonitoring}
        />
      </div>
    </>
  );
}
