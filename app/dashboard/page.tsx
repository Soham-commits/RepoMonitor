"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { RepoInput } from "@/src/components/RepoInput";
import { Dashboard } from "@/src/components/Dashboard";
import type { TeamProfile } from "@/src/utils/auth";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";

interface DashboardProfile {
  repos: string[];
  pat: string;
  teams?: TeamProfile[];
}

interface ParsedTeamResult {
  teams: TeamProfile[];
  hasRequiredColumns: boolean;
}

const REQUIRED_COLUMN_ERROR = "Could not detect required columns. Check your file format";

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "").replace(/-/g, "");

const findHeaderKey = (headers: string[], aliases: string[]) => {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeader(alias)));
  return headers.find((header) => aliasSet.has(normalizeHeader(header)));
};

const parseTeamsFromRows = (rows: Record<string, unknown>[]): ParsedTeamResult => {
  if (!rows.length) {
    return { teams: [], hasRequiredColumns: false };
  }

  const headers = Object.keys(rows[0]);
  const teamIdKey = findHeaderKey(headers, ["Team ID", "team_id", "teamid"]);
  const teamNameKey = findHeaderKey(headers, ["Team Name", "team_name", "teamname"]);
  const psIdKey = findHeaderKey(headers, ["PS ID", "ps_id", "psid"]);
  const repoLinkKey = findHeaderKey(headers, ["GitHub Repo Link", "github_repo", "repo", "repo_link"]);

  if (!teamIdKey || !teamNameKey || !psIdKey || !repoLinkKey) {
    return { teams: [], hasRequiredColumns: false };
  }

  const teams = rows
    .map((row) => ({
      teamId: String(row[teamIdKey] ?? "").trim(),
      teamName: String(row[teamNameKey] ?? "").trim(),
      psId: String(row[psIdKey] ?? "").trim(),
      repoLink: String(row[repoLinkKey] ?? "").trim(),
    }))
    .filter((team) => team.teamId && team.teamName && team.psId && team.repoLink);

  return { teams, hasRequiredColumns: true };
};

const parseCsvFile = (file: File): Promise<Record<string, unknown>[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
};

const parseExcelFile = async (file: File): Promise<Record<string, unknown>[]> => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
};

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
  const [pat, setPat] = useState("");
  const [isUploadScreen, setIsUploadScreen] = useState(false);
  const [isPatInputVisible, setIsPatInputVisible] = useState(false);
  const [isSavingPat, setIsSavingPat] = useState(false);
  const [patSaveError, setPatSaveError] = useState("");
  const [isUploadingData, setIsUploadingData] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dashboardSessionKey, setDashboardSessionKey] = useState(0);

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

        const persistedPat = typeof patPayload.pat === "string" ? patPayload.pat.trim() : "";
        setPrefilledPat(persistedPat);
        setPat(persistedPat);
        setIsPatInputVisible(!persistedPat);

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
    setPat(trimmedPat);
    setIsPatInputVisible(trimmedPat.length === 0);
    setIsUploadScreen(false);
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

  const handleOpenUploadScreen = () => {
    if (!profile) return;
    setIsUploadScreen(true);
    setUploadError("");
    setPatSaveError("");
    setIsPatInputVisible(!pat.trim());
    setIsDragging(false);
  };

  const handleBackToDashboard = () => {
    setIsUploadScreen(false);
    setUploadError("");
    setPatSaveError("");
    setIsPatInputVisible(false);
    setIsDragging(false);
  };

  const handleSavePat = async () => {
    setPatSaveError("");
    setIsSavingPat(true);

    try {
      const trimmedPat = pat.trim();
      const response = await fetch("/api/pat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pat: trimmedPat }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to save PAT");
      }

      setPat(trimmedPat);
      setPrefilledPat(trimmedPat);
      setIsPatInputVisible(trimmedPat.length === 0);
    } catch {
      setPatSaveError("Unable to save PAT. Please try again.");
    } finally {
      setIsSavingPat(false);
    }
  };

  const handleUpload = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isXlsx = fileName.endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      setUploadError("Only .xlsx or .csv files supported");
      return;
    }

    setIsUploadingData(true);
    setUploadError("");

    try {
      const rows = isCsv ? await parseCsvFile(file) : await parseExcelFile(file);
      const parsed = parseTeamsFromRows(rows);

      if (!parsed.hasRequiredColumns) {
        setUploadError(REQUIRED_COLUMN_ERROR);
        return;
      }

      const repos = buildReposFromTeams(parsed.teams);
      if (!repos.length) {
        setUploadError("No valid repositories found in uploaded team data");
        return;
      }

      const saveTeamsResponse = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teams: parsed.teams }),
      });

      if (!saveTeamsResponse.ok) {
        if (saveTeamsResponse.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("SAVE_TEAMS_FAILED");
      }

      const trimmedPat = pat.trim();
      if (trimmedPat) {
        const savePatResponse = await fetch("/api/pat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pat: trimmedPat }),
        });

        if (savePatResponse.status === 401) {
          router.replace("/login");
          return;
        }
      }

      setPrefilledPat(trimmedPat);
      setPat(trimmedPat);
      setProfile({ repos, pat: trimmedPat, teams: parsed.teams });
      setIsUploadScreen(false);
      setIsPatInputVisible(trimmedPat.length === 0);
      setDashboardSessionKey((previous) => previous + 1);
    } catch (error) {
      if (error instanceof Error && error.message === "SAVE_TEAMS_FAILED") {
        setUploadError("Could not save uploaded team data. Please try again");
      } else {
        setUploadError(REQUIRED_COLUMN_ERROR);
      }
    } finally {
      setIsUploadingData(false);
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    void handleUpload(droppedFile);
  };

  const hasSavedPat = pat.trim().length > 0;
  const shouldShowPatInput = isPatInputVisible || !hasSavedPat;
  const maskedPat = hasSavedPat ? `${pat.trim().slice(0, 4)}${"•".repeat(10)}` : "";

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
        <div className={isUploadScreen ? "hidden" : ""}>
          <Dashboard
            key={dashboardSessionKey}
            repos={profile.repos}
            pat={profile.pat}
            teams={profile.teams}
            onUploadNewData={handleOpenUploadScreen}
          />
        </div>

        {isUploadScreen && (
          <div className="min-h-screen relative w-full px-3 sm:px-4 md:px-6 py-6">
            <div className="fixed top-6 left-3 sm:left-4 md:left-6 z-20">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="text-xs md:text-sm px-4 py-2 rounded-xl border border-white/20 text-white/80 bg-white/10 hover:bg-white/15 transition-all"
              >
                ← Back to Dashboard
              </button>
            </div>

            <div className="w-full max-w-2xl mx-auto pt-16 md:pt-20">
              <div className="mb-4 md:mb-6 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg p-4 md:p-5">
                {shouldShowPatInput ? (
                  <div>
                    <div className="flex flex-col gap-3">
                      <div className="max-w-lg">
                        <p className="text-white font-semibold text-sm">GitHub Personal Access Token</p>
                        <p className="text-white/50 text-xs mt-1">Saved to MongoDB for your account and reused on next login.</p>
                      </div>

                      <div className="w-full flex flex-col sm:flex-row gap-2">
                        <input
                          type="password"
                          placeholder="ghp_..."
                          value={pat}
                          onChange={(event) => {
                            setPat(event.target.value);
                            setPatSaveError("");
                          }}
                          className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void handleSavePat();
                          }}
                          disabled={isSavingPat}
                          className="px-5 py-3 rounded-xl bg-white/12 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isSavingPat ? "Saving..." : "Save PAT"}
                        </button>
                      </div>
                    </div>

                    {patSaveError && <p className="mt-2 text-xs text-red-300">{patSaveError}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-white/55 text-xs uppercase tracking-wider">Current PAT</p>
                      <p className="text-white/85 text-sm font-mono mt-1">{maskedPat}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPatInputVisible(true);
                        setPatSaveError("");
                      }}
                      className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white/12 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all"
                    >
                      Change PAT
                    </button>
                  </div>
                )}
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative p-8 md:p-12 rounded-[2.5rem] bg-white/10 backdrop-blur-xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col items-center text-center gap-6 group ${
                  isDragging ? "border-white/30 bg-white/8 scale-[1.02]" : "border-white/15 hover:border-white/30"
                }`}
              >
                <div className="w-20 h-20 rounded-3xl bg-[#1E2CFF]/20 border border-[#1E2CFF]/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Upload className={`w-10 h-10 text-[#1E2CFF] ${isDragging ? "animate-bounce" : ""}`} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Upload Team Data</h2>
                  <p className="text-white/45 text-sm max-w-sm mx-auto leading-relaxed">
                    Upload Excel or CSV with Team ID, Team Name, PS ID, GitHub Repo Link
                  </p>
                </div>

                <label className="mt-4 relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void handleUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <div className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#1E2CFF] to-[#6A3DFF] text-white font-bold text-sm transition-all duration-300 hover:from-[#6A3DFF] hover:to-[#B06CFF] shadow-lg active:scale-95 uppercase tracking-wider min-h-12">
                    {isUploadingData ? "Uploading..." : "Select File"}
                  </div>
                </label>

                <div className="absolute top-6 right-6 opacity-10">
                  <FileSpreadsheet className="w-16 h-16 text-white" />
                </div>
              </div>
            </div>

            {uploadError && <p className="mt-5 text-red-400 text-sm text-center">{uploadError}</p>}
          </div>
        )}
      </div>
    </>
  );
}
