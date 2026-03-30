"use client";

import React, { useMemo, useState } from "react";
import { usePoller } from "../hooks/usePoller";
import { RepoRow, getRepoStatusAndDetails, RepoStatus } from "./RepoRow";
import { Search, Filter, ArrowUpDown, RefreshCw, Download, AlertTriangle, WifiOff, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, TeamProfile } from "../utils/auth";
import type { FetchRepoDataResult } from "../utils/github";

export interface DashboardProps {
  repos: string[];
  pat: string;
  teams?: TeamProfile[];
}

type SortKey = "Name" | "Hackathon Commits" | "Last Push" | "Contributors";

interface RepoRowItem {
  repoKey: string;
  data?: FetchRepoDataResult;
  details: ReturnType<typeof getRepoStatusAndDetails>;
  team: TeamProfile;
}

function parseRepoKey(repoLink: string): string | null {
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
}

export function Dashboard({ repos, pat, teams }: DashboardProps) {
  const {
    repoStates,
    pollStatus,
    nextPollIn,
    triggerManualRefresh,
    retryNow,
    lastPollTime,
    rateLimitState,
    hasFreshRateLimit,
    refreshingRepos,
  } = usePoller({ repos, pat });

  const apiRemainingDisplay =
    !hasFreshRateLimit && rateLimitState.remaining === 0 && rateLimitState.limit === 5000
      ? "\u2014"
      : String(rateLimitState.remaining);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | RepoStatus>("All");
  const [sortKey, setSortKey] = useState<SortKey>("Name");

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const normalizedTeams = useMemo(() => {
    const reposSet = new Set(repos);
    const mapped = new Map<string, TeamProfile>();

    (teams || []).forEach((team) => {
      const repoKey = parseRepoKey(team.repoLink);
      if (!repoKey || !reposSet.has(repoKey) || mapped.has(repoKey)) return;
      mapped.set(repoKey, {
        teamId: team.teamId,
        teamName: team.teamName,
        psId: team.psId || "Ungrouped",
        repoLink: team.repoLink || `https://github.com/${repoKey}`,
      });
    });

    return repos.map((repoKey, index) => {
      const existing = mapped.get(repoKey);
      if (existing) return existing;
      return {
        teamId: `TEAM-${index + 1}`,
        teamName: repoKey,
        psId: "Ungrouped",
        repoLink: `https://github.com/${repoKey}`,
      };
    });
  }, [repos, teams]);

  const allReposList = useMemo(() => {
    const teamByRepo = new Map<string, TeamProfile>();
    normalizedTeams.forEach((team) => {
      const key = parseRepoKey(team.repoLink) || "";
      if (key) teamByRepo.set(key, team);
    });

    return repos.map((repoKey, index) => {
      const data = repoStates.get(repoKey);
      const details = getRepoStatusAndDetails(data);
      const fallbackTeam: TeamProfile = {
        teamId: `TEAM-${index + 1}`,
        teamName: repoKey,
        psId: "Ungrouped",
        repoLink: `https://github.com/${repoKey}`,
      };
      return { repoKey, data, details, team: teamByRepo.get(repoKey) || fallbackTeam };
    });
  }, [repos, repoStates, normalizedTeams]);

  const stats = useMemo(() => {
    let active = 0;
    let idle = 0;
    let inactive = 0;
    let dead = 0;

    for (const item of allReposList) {
      if (item.details.status === "Active") active++;
      else if (item.details.status === "Idle") idle++;
      else if (item.details.status === "Inactive") inactive++;
      else if (item.details.status === "Dead") dead++;
    }

    return { active, idle, inactive, dead, total: repos.length };
  }, [allReposList, repos.length]);

  const groupedFilteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const grouped = new Map<string, RepoRowItem[]>();

    for (const item of allReposList) {
      if (query) {
        const haystack = [item.repoKey, item.team.teamName, item.team.teamId, item.team.psId].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          continue;
        }
      }

      if (statusFilter !== "All" && item.details.status !== statusFilter) {
        continue;
      }

      const psId = item.team.psId?.trim() || "Ungrouped";
      if (!grouped.has(psId)) {
        grouped.set(psId, []);
      }
      grouped.get(psId)?.push(item);
    }

    grouped.forEach((items) => {
      items.sort((a, b) => {
        if (sortKey === "Name") {
          return a.repoKey.localeCompare(b.repoKey);
        }

        if (sortKey === "Hackathon Commits") {
          return b.details.commitsCount - a.details.commitsCount;
        }

        if (sortKey === "Contributors") {
          const aContributors = a.details.contributorsCount || 0;
          const bContributors = b.details.contributorsCount || 0;
          return bContributors - aContributors;
        }

        if (sortKey === "Last Push") {
          const aPush = a.details.lastPushIso ? new Date(a.details.lastPushIso).getTime() : 0;
          const bPush = b.details.lastPushIso ? new Date(b.details.lastPushIso).getTime() : 0;
          return bPush - aPush;
        }

        return 0;
      });
    });

    return Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1;
      if (b === "Ungrouped") return -1;
      return a.localeCompare(b);
    });
  }, [allReposList, search, statusFilter, sortKey]);

  const handleExportCSV = () => {
    const header = [
      "PS ID",
      "#",
      "Team ID",
      "Team Name",
      "Owner",
      "Repo",
      "Status",
      "Last Push (ISO)",
      "Hackathon Commits",
      "Activity",
      "Contributors",
      "Flags",
    ];

    const rows: string[] = [];

    groupedFilteredAndSorted.forEach(([psId, items]) => {
      items.forEach((item, index) => {
        const [owner, repo] = item.repoKey.split("/");
        const lastPushIso = item.details.lastPushIso || "";
        const commits = item.details.commitsCount;
        const activity = item.details.recentCommitsCount;
        const contributors = item.details.contributorsCount !== null ? String(item.details.contributorsCount) : "";

        const flags: string[] = [];
        const data = item.data;
        if (item.details.status === "Error" && data?.error === "not_found") flags.push("Private/NotFound");
        else if (data?.repoInfo?.visibility === "private") flags.push("Private");
        if (commits === 0 && item.details.status !== "Loading" && item.details.status !== "Error") flags.push("ZeroCommits");
        if (contributors === "1") flags.push("SoloContributor");

        rows.push(
          [
            `"${psId}"`,
            index + 1,
            `"${item.team.teamId}"`,
            `"${item.team.teamName}"`,
            `"${owner}"`,
            `"${repo}"`,
            `"${item.details.status}"`,
            `"${lastPushIso}"`,
            commits,
            activity,
            contributors,
            `"${flags.join(", ")}"`,
          ].join(",")
        );
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + [header.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `ignisia-repos-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen relative flex justify-center py-10 px-6 font-sans">
      <div className="fixed bottom-8 left-8 z-30">
        <button
          onClick={() => {
            auth.logout();
            window.location.href = "/";
          }}
          className="px-6 py-2 rounded-full bg-white/8 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-xl group cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>

      <div className="z-10 w-full max-w-[1600px] flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Monitor Dashboard</h1>

          <div className="ml-auto text-sm text-white/45 space-y-1 bg-white/8 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <p className="text-right font-mono uppercase tracking-widest text-[10px]">
              API STATUS: <span className="text-cyan-400">{apiRemainingDisplay}</span> / {rateLimitState.limit}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {(pollStatus === "degraded" || pollStatus === "critical") && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-200 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
            >
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div className="text-sm">
                <strong>{pollStatus === "critical" ? "Critical Rate Limit Reached." : "API Rate Limit Warning."}</strong>
                {pollStatus === "critical"
                  ? " Poller paused to prevent GitHub block. It will resume next hour window."
                  : " Entering degraded Tier 1 mode. Idle repos skipped to conserve API requests."}
              </div>
              {pollStatus === "critical" && (
                <button
                  onClick={retryNow}
                  className="ml-auto px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-400/30 text-orange-100 text-xs font-bold uppercase tracking-wider hover:bg-orange-500/30 transition-all"
                >
                  Retry Now
                </button>
              )}
            </motion.div>
          )}

          {pollStatus === "frozen" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
            >
              <WifiOff className="w-5 h-5 text-red-400" />
              <div className="text-sm">
                <strong>Network connectivity offline.</strong> Poller is frozen. Displaying cache from{" "}
                {lastPollTime ? lastPollTime.toLocaleTimeString() : "last check"}.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-6 rounded-3xl bg-white/8 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-cyan-100 font-medium">Total Teams</span>
            <span className="text-3xl font-bold text-white">{stats.total}</span>
          </div>
          <div className="p-6 rounded-3xl bg-white/8 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-green-200 font-medium">Active</span>
            <span className="text-3xl font-bold text-green-400">{stats.active}</span>
          </div>
          <div className="p-6 rounded-3xl bg-white/8 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-yellow-200 font-medium">Idle</span>
            <span className="text-3xl font-bold text-yellow-400">{stats.idle}</span>
          </div>
          <div className="p-6 rounded-3xl bg-white/8 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-red-200 font-medium">No Activity</span>
            <span className="text-3xl font-bold text-red-400">{stats.inactive}</span>
          </div>
          <div className="p-6 rounded-3xl bg-white/8 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-white/70 font-medium">Dead</span>
            <span className="text-3xl font-bold text-white">{stats.dead}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shadow-xl w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team, PS ID, owner/repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-sm"
            />
          </div>

          <div className="w-px h-8 bg-white/10 hidden md:block" />

          <div className="relative">
            <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              title="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | RepoStatus)}
              className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[140px] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Idle">Idle</option>
              <option value="Inactive">Inactive</option>
              <option value="Dead">Dead</option>
            </select>
          </div>

          <div className="relative">
            <ArrowUpDown className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              title="Sort Options"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[170px] cursor-pointer"
            >
              <option value="Name">Sort: Name (A-Z)</option>
              <option value="Hackathon Commits">Sort: Hackathon Commits</option>
              <option value="Last Push">Sort: Last Push</option>
              <option value="Contributors">Sort: Contributors</option>
            </select>
          </div>

          <div className="w-px h-8 bg-white/10 hidden md:block" />

          <div className="flex gap-3 ml-auto items-center">
            <div className="flex flex-col items-end mr-2">
              <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-0.5">Next Refresh</span>
              <span className="text-sm font-mono text-cyan-300 font-medium">
                {pollStatus === "frozen" || pollStatus === "critical" ? "--:--" : formatCountdown(nextPollIn)}
              </span>
            </div>

            <button
              onClick={triggerManualRefresh}
              disabled={pollStatus === "polling" || pollStatus === "critical"}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-100 font-medium border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${pollStatus === "polling" ? "animate-spin" : ""}`} />
              <span className="whitespace-nowrap hidden sm:inline">Refresh Now</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-orange-500/10 text-orange-200 font-medium border border-orange-500/20 hover:bg-orange-500/20 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {groupedFilteredAndSorted.length > 0 ? (
            groupedFilteredAndSorted.map(([psId, items]) => (
              <section key={psId} className="rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/10">
                  <div className="bg-white/8 backdrop-blur-md border border-white/15 rounded-xl px-5 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide">PS ID: {psId}</h3>
                    <span className="text-white/45 text-xs font-medium">
                      {items.length} {items.length === 1 ? "Team" : "Teams"}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
                    <thead>
                      <tr className="bg-white/8 border-b border-white/10 text-[10px] uppercase tracking-wider">
                        <th className="py-5 px-2 font-black text-white/40 text-center w-12">#</th>
                        <th className="py-5 px-4 font-black text-white w-56">Repository</th>
                        <th className="py-5 px-3 font-black text-white w-28">Last Push</th>
                        <th className="py-5 px-2 font-black text-white text-center w-24">Hackathon Commits</th>
                        <th className="py-5 px-2 font-black text-white text-center w-24">Activity</th>
                        <th className="py-5 px-2 font-black text-white text-center w-28">Contributors</th>
                        <th className="py-5 px-2 font-black text-white w-auto">Last Commit Message</th>
                        <th className="py-5 px-3 font-black text-white text-center w-32">Status</th>
                        <th className="py-5 px-4 font-black text-white w-32">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <RepoRow
                          key={item.repoKey}
                          index={index}
                          repoKey={item.repoKey}
                          teamName={item.team.teamName}
                          data={item.data}
                          isRefreshing={refreshingRepos.has(item.repoKey)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          ) : (
            <div className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-12 text-center text-white/45 italic backdrop-blur-md shadow-2xl">
              No teams found matching your filters.
            </div>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `,
        }}
      />
    </div>
  );
}
