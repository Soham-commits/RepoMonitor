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

const parseRepoKey = (repoLink: string): string | null => {
  const trimmed = repoLink.trim().replace(/\.git$/i, "");
  if (!trimmed) return null;

  const parsePath = (pathValue: string) => {
    const parts = pathValue.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.toLowerCase().includes("github.com")) return null;
      return parsePath(url.pathname);
    } catch {
      return null;
    }
  }

  if (/^github\.com\//i.test(trimmed)) {
    return parsePath(trimmed.replace(/^github\.com\//i, ""));
  }

  return parsePath(trimmed);
};

const sanitizeTeamsPayload = (value: unknown): TeamProfile[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const team = item as Partial<TeamProfile>;
      const teamId = typeof team.teamId === "string" ? team.teamId.trim() : "";
      const teamName = typeof team.teamName === "string" ? team.teamName.trim() : "";
      const psId = typeof team.psId === "string" ? team.psId.trim() : "";
      const repoLink = typeof team.repoLink === "string" ? team.repoLink.trim() : "";

      if (!teamId || !teamName || !psId || !repoLink) {
        return null;
      }

      return {
        teamId,
        teamName,
        psId,
        repoLink,
      };
    })
    .filter((team): team is TeamProfile => Boolean(team));
};

const buildReposFromTeams = (teams: TeamProfile[]): string[] => {
  const seen = new Set<string>();
  const repos: string[] = [];

  teams.forEach((team) => {
    const repoKey = parseRepoKey(team.repoLink);
    if (!repoKey || seen.has(repoKey)) return;
    seen.add(repoKey);
    repos.push(repoKey);
  });

  return repos;
};

const buildFallbackTeams = (repos: string[]): TeamProfile[] => {
  return repos.map((repoKey, index) => ({
    teamId: `TEAM-${index + 1}`,
    teamName: repoKey,
    psId: "Ungrouped",
    repoLink: `https://github.com/${repoKey}`,
  }));
};

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [prefilledPat, setPrefilledPat] = useState("");

  useEffect(() => {
    const verifySession = async () => {
      try {
        const authResponse = await fetch("/api/auth/me", { cache: "no-store" });

        if (!authResponse.ok) {
          router.replace("/login");
          return;
        }

        const [patResponse, teamsResponse] = await Promise.all([
          fetch("/api/pat", { cache: "no-store" }),
          fetch("/api/teams", { cache: "no-store" }),
        ]);

        if (patResponse.status === 401 || teamsResponse.status === 401) {
          router.replace("/login");
          return;
        }

        const patPayload = patResponse.ok
          ? ((await patResponse.json()) as { pat?: string | null })
          : { pat: null };

        const teamsPayload = teamsResponse.ok
          ? ((await teamsResponse.json()) as { teams?: unknown })
          : { teams: [] };

        const persistedPat = typeof patPayload.pat === "string" ? patPayload.pat : "";
        setPrefilledPat(persistedPat);

        const persistedTeams = sanitizeTeamsPayload(teamsPayload.teams);

        if (persistedTeams.length > 0) {
          const repos = buildReposFromTeams(persistedTeams);
          if (repos.length > 0) {
            setProfile({
              repos,
              pat: persistedPat,
              teams: persistedTeams,
            });
          }
        }

        setIsAuthorized(true);
      } catch {
        router.replace("/login");
      }
    };

    void verifySession();
  }, [router]);

  const handleStartMonitoring = (repos: string[], pat: string, teams?: TeamProfile[]) => {
    const trimmedPat = pat.trim();
    const normalizedTeams = sanitizeTeamsPayload(teams ?? []);
    const teamsToPersist = normalizedTeams.length > 0 ? normalizedTeams : buildFallbackTeams(repos);

    setPrefilledPat(trimmedPat);
    setProfile({ repos, pat: trimmedPat, teams: teamsToPersist });

    void (async () => {
      try {
        const [teamsResponse, patResponse] = await Promise.all([
          fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teams: teamsToPersist }),
          }),
          fetch("/api/pat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pat: trimmedPat }),
          }),
        ]);

        if (teamsResponse.status === 401 || patResponse.status === 401) {
          router.replace("/login");
        }
      } catch {
        // Keep monitoring active even if persistence fails transiently.
      }
    })();
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
          <RepoInput onStart={handleStartMonitoring} initialPat={prefilledPat} />
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
