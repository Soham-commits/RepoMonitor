"use client";

import { useEffect, useState } from "react";
import { RepoInput } from "@/src/components/RepoInput";
import { Dashboard } from "@/src/components/Dashboard";
import type { TeamProfile } from "@/src/utils/auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";

interface DashboardProfile {
  repos: string[];
  pat: string;
  teams?: TeamProfile[];
}

const DASHBOARD_PROFILE_KEY = "ignistrack-dashboard-profile";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<DashboardProfile | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawProfile = localStorage.getItem(DASHBOARD_PROFILE_KEY);

    if (!rawProfile) {
      return null;
    }

    try {
      const parsedProfile = JSON.parse(rawProfile) as DashboardProfile;

      if (!Array.isArray(parsedProfile.repos)) {
        return null;
      }

      return parsedProfile;
    } catch {
      localStorage.removeItem(DASHBOARD_PROFILE_KEY);
      return null;
    }
  });

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        setIsAuthorized(true);
      } catch {
        router.replace("/login");
      }
    };

    void verifySession();
  }, [router]);

  const handleStartMonitoring = (repos: string[], pat: string, teams?: TeamProfile[]) => {
    const nextProfile: DashboardProfile = { repos, pat, teams };
    localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
  };

  if (isAuthorized === null) {
    return (
      <>
        <VideoBackground />
        <div className="min-h-screen bg-[#02020A] flex items-center justify-center relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E2CFF]" />
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <VideoBackground />
        <div className="relative z-10">
          <RepoInput onStart={handleStartMonitoring} />
        </div>
      </>
    );
  }

  return (
    <>
      <VideoBackground />
      <div className="relative z-10">
        <Dashboard repos={profile.repos} pat={profile.pat} teams={profile.teams} />
      </div>
    </>
  );
}
