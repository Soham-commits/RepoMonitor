"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePoller } from "../hooks/usePoller";
import { RepoRow, getRepoStatusAndDetails, RepoStatus } from "./RepoRow";
import { Search, Filter, ArrowUpDown, RefreshCw, Download, AlertTriangle, WifiOff, LogOut, Menu, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { TeamProfile } from "../utils/auth";
import type { FetchRepoDataResult } from "../utils/github";

export interface DashboardProps {
  repos: string[];
  pat: string;
  teams?: TeamProfile[];
  onUploadNewData?: () => void;
}

type SortKey = "Name" | "Hackathon Commits" | "Last Push" | "Contributors";

interface RepoRowItem {
  repoKey: string;
  data?: FetchRepoDataResult;
  details: ReturnType<typeof getRepoStatusAndDetails>;
  team: TeamProfile;
}

interface RepoCardFlag {
  text: string;
  className: string;
}

interface AgentStatusSnapshot {
  connected: boolean;
  configured: boolean;
  cronRunning: boolean;
  isExecuting: boolean;
  runCounter: number;
  currentActivity: string;
  message: string | null;
  lastErrorMessage: string | null;
  lastRunFinishedAt: string | null;
  lastRunSummary: string | null;
  lastAlertSentCount: number;
  lastAlertFailedCount: number;
}

const DEFAULT_AGENT_STATUS: AgentStatusSnapshot = {
  connected: false,
  configured: false,
  cronRunning: false,
  isExecuting: false,
  runCounter: 0,
  currentActivity: "Checking monitor state",
  message: null,
  lastErrorMessage: null,
  lastRunFinishedAt: null,
  lastRunSummary: null,
  lastAlertSentCount: 0,
  lastAlertFailedCount: 0,
};

function getRelativePushText(isoString: string | null): string {
  if (!isoString) return "N/A";

  const pushed = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - pushed;

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getStatusBadgeClass(statusText: string): string {
  if (statusText === "Active") return "bg-green-500 text-black";
  if (statusText === "Idle") return "bg-yellow-400 text-black";
  if (statusText === "Inactive") return "bg-red-500 text-white";
  if (statusText === "Dead") return "bg-white/8 text-white/45 border border-white/15";
  if (statusText === "TIMEOUT") return "bg-[#6A3DFF] text-black";
  if (statusText === "Error") return "bg-red-900/50 text-red-200 border border-red-500/30";
  if (statusText === "PRIVATE") return "bg-white/8 text-white/70 border border-white/15";
  return "bg-white/8 text-white/45 border border-white/15";
}

function getCardMeta(item: RepoRowItem): {
  statusText: string;
  statusClass: string;
  lastPushText: string;
  commitCount: string;
  flags: RepoCardFlag[];
} {
  const { data, details } = item;
  const isPrivate = data?.error === "not_found" || data?.repoInfo?.visibility === "private";
  const isTimeout = data?.error === "timeout";

  const flags: RepoCardFlag[] = [];
  if (isPrivate) {
    flags.push({ text: "PRIVATE", className: "bg-gray-500 text-white" });
  } else {
    if (isTimeout) flags.push({ text: "TIMEOUT", className: "bg-[#6A3DFF] text-black" });
    if (details.commitsCount === 0 && details.status !== "Loading") {
      flags.push({ text: "NO COMMITS", className: "bg-red-500 text-white" });
    }
    if (details.contributorsCount === 1) {
      flags.push({ text: "SOLO", className: "bg-yellow-500 text-black" });
    }
  }

  const statusText = isPrivate ? "PRIVATE" : details.status === "Timeout" ? "TIMEOUT" : details.status;

  return {
    statusText,
    statusClass: getStatusBadgeClass(statusText),
    lastPushText: isPrivate ? "-" : getRelativePushText(details.lastPushIso),
    commitCount: isPrivate ? "-" : details.status === "Loading" ? "-" : String(details.commitsCount),
    flags,
  };
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

export function Dashboard({ repos, pat, teams, onUploadNewData }: DashboardProps) {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusSnapshot>(DEFAULT_AGENT_STATUS);
  const [agentStatusLoading, setAgentStatusLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    let isMounted = true;

    const fetchAgentStatus = async () => {
      try {
        const response = await fetch("/api/agent/status", { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Agent status request failed: ${response.status}`);
        }

        const payload = (await response.json()) as Partial<AgentStatusSnapshot>;

        if (!isMounted) {
          return;
        }

        setAgentStatus({
          connected: Boolean(payload.connected),
          configured: Boolean(payload.configured),
          cronRunning: Boolean(payload.cronRunning),
          isExecuting: Boolean(payload.isExecuting),
          runCounter: Number(payload.runCounter ?? 0),
          currentActivity: String(payload.currentActivity ?? DEFAULT_AGENT_STATUS.currentActivity),
          message: payload.message ? String(payload.message) : null,
          lastErrorMessage: payload.lastErrorMessage ? String(payload.lastErrorMessage) : null,
          lastRunFinishedAt: payload.lastRunFinishedAt ? String(payload.lastRunFinishedAt) : null,
          lastRunSummary: payload.lastRunSummary ? String(payload.lastRunSummary) : null,
          lastAlertSentCount: Number(payload.lastAlertSentCount ?? 0),
          lastAlertFailedCount: Number(payload.lastAlertFailedCount ?? 0),
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAgentStatus((previous) => ({
          ...previous,
          connected: false,
          message:
            error instanceof Error
              ? error.message
              : "Agent status request failed",
        }));
      } finally {
        if (isMounted) {
          setAgentStatusLoading(false);
        }
      }
    };

    void fetchAgentStatus();

    const intervalId = window.setInterval(() => {
      void fetchAgentStatus();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

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

  const agentStateLabel = agentStatusLoading
    ? "Checking"
    : !agentStatus.configured
      ? "Not Configured"
      : !agentStatus.connected
        ? "Offline"
        : agentStatus.isExecuting
          ? "Analyzing"
          : agentStatus.cronRunning
            ? "Active"
            : "Paused";

  const agentDotClass = agentStatusLoading
    ? "bg-white/40"
    : !agentStatus.configured || !agentStatus.connected
      ? "bg-red-400"
      : agentStatus.isExecuting
        ? "bg-cyan-400"
        : agentStatus.cronRunning
          ? "bg-green-400"
          : "bg-yellow-300";

  const agentDetailText =
    agentStatus.lastErrorMessage ||
    agentStatus.message ||
    agentStatus.currentActivity;

  const agentLastRunText = agentStatus.lastRunFinishedAt
    ? `Last run ${getRelativePushText(agentStatus.lastRunFinishedAt)}`
    : "No runs yet";

  return (
    <div className="min-h-screen relative flex justify-center py-6 md:py-10 px-3 sm:px-4 md:px-6 font-sans overflow-x-hidden">
      <div className="fixed bottom-6 left-4 z-30 hidden md:block">
        <button
          onClick={() => {
            void handleLogout();
          }}
          className="px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white/75 text-xs font-medium hover:bg-white/15 hover:text-white transition-all duration-300 ease-in-out flex items-center gap-2 backdrop-blur-xl group cursor-pointer shadow-lg"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>

      <div className="fixed bottom-6 right-4 z-30 hidden md:block">
        <div className="max-w-[320px] px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${agentDotClass} ${agentStatus.isExecuting ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">AI Agent</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white">{agentStateLabel}</span>
          </div>
          <p className="mt-2 text-xs text-white/75">{agentDetailText}</p>
          <p className="mt-1 text-[10px] text-white/55">{agentLastRunText}</p>
          <p className="mt-1 text-[10px] text-white/55">
            Alerts sent: {agentStatus.lastAlertSentCount} | failed: {agentStatus.lastAlertFailedCount}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50"
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute right-3 top-3 bottom-3 h-auto w-[82%] max-w-sm rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold uppercase tracking-wide text-white">Dashboard Menu</h2>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white/70 font-mono uppercase tracking-wider shadow-lg">
                  API: <span className="text-cyan-400">{apiRemainingDisplay}</span> / {rateLimitState.limit}
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white/70 font-mono uppercase tracking-wider shadow-lg">
                  Next Refresh: {pollStatus === "frozen" || pollStatus === "critical" ? "--:--" : formatCountdown(nextPollIn)}
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white/70 shadow-lg">
                  <div className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <span className={`h-2 w-2 rounded-full ${agentDotClass} ${agentStatus.isExecuting ? "animate-pulse" : ""}`} />
                    AI Agent: <span className="text-cyan-300">{agentStateLabel}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-white/60 normal-case tracking-normal">{agentDetailText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerManualRefresh();
                    setMobileMenuOpen(false);
                  }}
                  disabled={pollStatus === "polling" || pollStatus === "critical"}
                  className="w-full px-4 py-3 rounded-2xl bg-cyan-500/10 text-cyan-100 border border-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${pollStatus === "polling" ? "animate-spin" : ""}`} />
                  Refresh Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportCSV();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-orange-500/10 text-orange-200 border border-orange-500/20 flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                {onUploadNewData && (
                  <button
                    type="button"
                    onClick={() => {
                      onUploadNewData();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white border border-white/20 flex items-center justify-center gap-2 text-sm"
                  >
                    Upload New Data
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white border border-white/20 flex items-center justify-center gap-2 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="z-10 w-full max-w-[1600px] flex flex-col gap-5 md:gap-8">
        <div className="sticky top-3 z-40 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg px-4 md:px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">Monitor Dashboard</h1>
            <div className="ml-auto hidden md:flex items-center gap-3">
              {onUploadNewData && (
                <button
                  type="button"
                  onClick={onUploadNewData}
                  className="px-5 py-2 rounded-full bg-transparent text-white/70 text-xs font-medium hover:bg-white/15 hover:text-white transition-all duration-300 ease-in-out whitespace-nowrap"
                >
                  Upload New Data
                </button>
              )}
              <div className="text-sm text-white/45 space-y-1">
                <p className="text-right font-mono uppercase tracking-widest text-[10px]">
                  API STATUS: <span className="text-cyan-400">{apiRemainingDisplay}</span> / {rateLimitState.limit}
                </p>
              </div>
            </div>
            <div className="ml-auto md:hidden flex items-center gap-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/60">
                API: <span className="text-cyan-400">{apiRemainingDisplay}</span>
              </div>
              <button
                type="button"
                aria-label="Open mobile menu"
                onClick={() => setMobileMenuOpen(true)}
                className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {(pollStatus === "degraded" || pollStatus === "critical") && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-200 p-3 md:p-4 rounded-2xl flex items-start md:items-center gap-3 backdrop-blur-md"
            >
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5 md:mt-0" />
              <div className="text-xs md:text-sm">
                <strong>{pollStatus === "critical" ? "Critical Rate Limit Reached." : "API Rate Limit Warning."}</strong>
                {pollStatus === "critical"
                  ? " Poller paused to prevent GitHub block. It will resume next hour window."
                  : " Entering degraded Tier 1 mode. Idle repos skipped to conserve API requests."}
              </div>
              {pollStatus === "critical" && (
                <button
                  onClick={retryNow}
                  className="ml-auto px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-400/30 text-orange-100 text-xs font-bold uppercase tracking-wider hover:bg-orange-500/30 transition-all"
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
              className="w-full bg-red-500/10 border border-red-500/20 text-red-200 p-3 md:p-4 rounded-2xl flex items-start md:items-center gap-3 backdrop-blur-md"
            >
              <WifiOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5 md:mt-0" />
              <div className="text-xs md:text-sm">
                <strong>Network connectivity offline.</strong> Poller is frozen. Displaying cache from{" "}
                {lastPollTime ? lastPollTime.toLocaleTimeString() : "last check"}.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="p-4 md:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs md:text-sm text-cyan-100 font-medium">Total Teams</span>
            <span className="text-2xl md:text-3xl font-bold text-white">{stats.total}</span>
          </div>
          <div className="p-4 md:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs md:text-sm text-green-200 font-medium">Active</span>
            <span className="text-2xl md:text-3xl font-bold text-green-400">{stats.active}</span>
          </div>
          <div className="p-4 md:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs md:text-sm text-yellow-200 font-medium">Idle</span>
            <span className="text-2xl md:text-3xl font-bold text-yellow-400">{stats.idle}</span>
          </div>
          <div className="p-4 md:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs md:text-sm text-red-200 font-medium">No Activity</span>
            <span className="text-2xl md:text-3xl font-bold text-red-400">{stats.inactive}</span>
          </div>
          <div className="p-4 md:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs md:text-sm text-white/70 font-medium">Dead</span>
            <span className="text-2xl md:text-3xl font-bold text-white">{stats.dead}</span>
          </div>
        </div>

        <div className="hidden md:flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/10 border border-white/20 p-4 rounded-2xl backdrop-blur-xl shadow-lg w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team, PS ID, owner/repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-sm"
            />
          </div>

          <div className="w-px h-8 bg-white/10 hidden md:block" />

          <div className="relative">
            <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              title="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | RepoStatus)}
              className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[140px] cursor-pointer"
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
              className="bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none min-w-[170px] cursor-pointer"
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
              className="px-4 py-3 rounded-xl bg-cyan-500/10 text-cyan-100 font-medium border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${pollStatus === "polling" ? "animate-spin" : ""}`} />
              <span className="whitespace-nowrap">Refresh Now</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-3 rounded-xl bg-orange-500/10 text-orange-200 font-medium border border-orange-500/20 hover:bg-orange-500/20 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap">Export CSV</span>
            </button>
          </div>
        </div>

        <div className="md:hidden rounded-2xl bg-white/10 border border-white/20 p-3 backdrop-blur-xl shadow-lg">
          <button
            type="button"
            onClick={() => setMobileControlsOpen((prev) => !prev)}
            className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-white text-sm font-medium flex items-center justify-between"
          >
            Controls, Search, and Sort
            {mobileControlsOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {mobileControlsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 space-y-3"
              >
                <div className="relative">
                  <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search team, PS ID, owner/repo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-sm"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    title="Status Filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "All" | RepoStatus)}
                    className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none"
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
                    className="w-full bg-white/8 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-white/30 text-sm appearance-none"
                  >
                    <option value="Name">Sort: Name (A-Z)</option>
                    <option value="Hackathon Commits">Sort: Hackathon Commits</option>
                    <option value="Last Push">Sort: Last Push</option>
                    <option value="Contributors">Sort: Contributors</option>
                  </select>
                </div>
                <div className="rounded-xl bg-white/8 border border-white/10 px-4 py-3 text-xs font-mono uppercase tracking-wider text-cyan-300">
                  Next Refresh: {pollStatus === "frozen" || pollStatus === "critical" ? "--:--" : formatCountdown(nextPollIn)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6 md:space-y-8">
          {groupedFilteredAndSorted.length > 0 ? (
            groupedFilteredAndSorted.map(([psId, items]) => (
              <section key={psId} className="rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                <div className="px-4 sm:px-6 py-4 md:py-5 border-b border-white/10">
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-4 sm:px-5 py-3 flex items-center justify-between shadow-lg">
                    <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide">PS ID: {psId}</h3>
                    <span className="text-white/45 text-xs font-medium">
                      {items.length} {items.length === 1 ? "Team" : "Teams"}
                    </span>
                  </div>
                </div>

                <div className="md:hidden px-4 py-4 space-y-3">
                  {items.map((item, index) => {
                    const [ownerName, repoName] = item.repoKey.split("/");
                    const card = getCardMeta(item);

                    return (
                      <article key={item.repoKey} className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 shadow-lg">
                        <div className="flex items-start justify-between gap-3">
                          <a
                            href={`https://github.com/${item.repoKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 text-white font-semibold leading-tight"
                          >
                            <span className="block text-white/70 text-xs">#{index + 1}</span>
                            <span className="block truncate text-white/80 text-xs">{ownerName}/</span>
                            <span className="block truncate text-sm">{repoName || item.repoKey}</span>
                          </a>
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${card.statusClass}`}>
                            {card.statusText}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2">
                            <p className="text-white/45 uppercase tracking-wider text-[10px]">Last Push</p>
                            <p className="text-white font-semibold mt-1">{card.lastPushText}</p>
                          </div>
                          <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2">
                            <p className="text-white/45 uppercase tracking-wider text-[10px]">Hackathon Commits</p>
                            <p className="text-white font-semibold mt-1">{card.commitCount}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5 min-h-[20px]">
                            {card.flags.length > 0 ? (
                              card.flags.map((flag) => (
                                <span
                                  key={`${item.repoKey}-${flag.text}`}
                                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${flag.className}`}
                                >
                                  {flag.text}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/30 text-[10px]">-</span>
                            )}
                          </div>
                          <a
                            href={`https://github.com/${item.repoKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#B06CFF] inline-flex items-center gap-1 text-xs"
                          >
                            Open
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
                    <thead>
                      <tr className="bg-white/10 border-b border-white/10 text-[10px] uppercase tracking-wider">
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
            <div className="w-full bg-white/10 border border-white/20 rounded-[2rem] p-8 md:p-12 text-center text-white/45 italic backdrop-blur-xl shadow-lg">
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
