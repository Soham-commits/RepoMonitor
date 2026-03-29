"use client";

import React, { useState, useMemo } from "react";
import { usePoller } from "../hooks/usePoller";
import { RepoRow, getRepoStatusAndDetails, RepoStatus } from "./RepoRow";
import { CommitModal } from "./CommitModal";
import { MeshGradient } from "@paper-design/shaders-react";
import { Flame, Search, Filter, ArrowUpDown, RefreshCw, Download, AlertTriangle, WifiOff, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { auth } from "../utils/auth";

export interface DashboardProps {
  repos: string[];
  pat: string;
}

export function Dashboard({ repos, pat }: DashboardProps) {
  const {
    repoStates,
    pollStatus,
    nextPollIn,
    triggerManualRefresh,
    retryNow,
    lastPollTime,
    rateLimitState,
    hasFreshRateLimit,
    refreshingRepos
  } = usePoller({ repos, pat });

  const apiRemainingDisplay =
    !hasFreshRateLimit && rateLimitState.remaining === 0 && rateLimitState.limit === 5000
      ? "—"
      : String(rateLimitState.remaining);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | RepoStatus>("All");
  const [sortKey, setSortKey] = useState<"Name" | "Hackathon Commits" | "Last Push" | "Contributors">("Name");
  const [modalRepoKey, setModalRepoKey] = useState<string | null>(null);

  // Format countdown mm:ss
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert map to array with details computed
  const allReposList = useMemo(() => {
    return repos.map(repoKey => {
      const data = repoStates.get(repoKey);
      const details = getRepoStatusAndDetails(data);
      return { repoKey, data, details };
    });
  }, [repos, repoStates]);

  // Derive stats
  const stats = useMemo(() => {
    let active = 0, idle = 0, inactive = 0, dead = 0;
    for (const item of allReposList) {
      if (item.details.status === "Active") active++;
      else if (item.details.status === "Idle") idle++;
      else if (item.details.status === "Inactive") inactive++;
      else if (item.details.status === "Dead") dead++;
    }
    return { active, idle, inactive, dead, total: repos.length };
  }, [allReposList, repos.length]);

  // Filtering & Sorting
  const filteredAndSorted = useMemo(() => {
    let result = [...allReposList];

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(item => item.repoKey.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter(item => item.details.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortKey === "Name") {
        return a.repoKey.localeCompare(b.repoKey);
      } else if (sortKey === "Hackathon Commits") {
        return b.details.commitsCount - a.details.commitsCount;
      } else if (sortKey === "Contributors") {
        const cA = a.details.contributorsCount || 0;
        const cB = b.details.contributorsCount || 0;
        return cB - cA; // Descending
      } else if (sortKey === "Last Push") {
        const pA = a.details.lastPushIso ? new Date(a.details.lastPushIso).getTime() : 0;
        const pB = b.details.lastPushIso ? new Date(b.details.lastPushIso).getTime() : 0;
        return pB - pA; // Descending, newest first
      }
      return 0;
    });

    return result;
  }, [allReposList, search, statusFilter, sortKey]);

  // CSV Export
  const handleExportCSV = () => {
    const header = ["#", "Owner", "Repo", "Status", "Last Push (ISO)", "Hackathon Commits", "Contributors", "Flags"];
    const rows = filteredAndSorted.map((item, index) => {
      const [owner, repo] = item.repoKey.split("/");
      const lastPushIso = item.details.lastPushIso || "";
      const commits = item.details.commitsCount;
      const contributors = item.details.contributorsCount !== null ? String(item.details.contributorsCount) : "";
      
      const flags = [];
      const data = item.data;
      if (item.details.status === "Error" && data?.error === "not_found") flags.push("Private/NotFound");
      else if (data?.repoInfo?.visibility === "private") flags.push("Private");
      if (commits === 0 && item.details.status !== "Loading" && item.details.status !== "Error") flags.push("ZeroCommits");
      if (contributors === "1") flags.push("SoloContributor");

      return [
        index + 1,
        `"${owner}"`,
        `"${repo}"`,
        `"${item.details.status}"`,
        `"${lastPushIso}"`,
        commits,
        contributors,
        `"${flags.join(", ")}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [header.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `ignisia-repos-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen relative bg-black flex justify-center py-10 px-6 font-sans">
      {/* Sign Out Button - Bottom Left */}
      <div className="fixed bottom-8 left-8 z-30">
        <button 
          onClick={() => {
            auth.logout();
            window.location.href = "/";
          }}
          className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm group cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>

      {/* Background Gradient Mesh */}

      <div className="fixed inset-0 z-0 pointer-events-none">
        <MeshGradient
          className="absolute inset-0 w-full h-full"
          colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
          speed={0.3}
        />
        <MeshGradient
          className="absolute inset-0 w-full h-full opacity-60"
          colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
          speed={0.2}
        />
      </div>

      <div className="z-10 w-full max-w-[1600px] flex flex-col gap-8">
        
        {/* Header Title */}
        <div className="flex items-center gap-4">
          <Flame className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Monitor Dashboard</h1>
          
          <div className="ml-auto text-sm text-white/50 space-y-1 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-sm">
             <p className="text-right font-mono uppercase tracking-widest text-[10px]">API STATUS: <span className="text-cyan-400">{apiRemainingDisplay}</span> / {rateLimitState.limit}</p>
          </div>
        </div>

        {/* Degradation Warnings */}
        <AnimatePresence>
          {(pollStatus === 'degraded' || pollStatus === 'critical') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-200 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
            >
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div className="text-sm">
                <strong>{pollStatus === 'critical' ? 'Critical Rate Limit Reached.' : 'API Rate Limit Warning.'}</strong> 
                {pollStatus === 'critical' 
                   ? ' Poller paused to prevent GitHub block. It will resume next hour window.'
                   : ' Entering degraded Tier 1 mode. Idle repos skipped to conserve API requests.'}
              </div>
              {pollStatus === 'critical' && (
                <button
                  onClick={retryNow}
                  className="ml-auto px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-400/30 text-orange-100 text-xs font-bold uppercase tracking-wider hover:bg-orange-500/30 transition-all"
                >
                  Retry Now
                </button>
              )}
            </motion.div>
          )}

          {pollStatus === 'frozen' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
            >
              <WifiOff className="w-5 h-5 text-red-400" />
              <div className="text-sm">
                <strong>Network connectivity offline.</strong> Poller is frozen. Displaying cache from {lastPollTime ? Math.round((Date.now() - lastPollTime.getTime()) / 60000) + ' min ago' : 'last check'}.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-cyan-100 font-medium">Total Teams</span>
            <span className="text-3xl font-bold text-white">{stats.total}</span>
          </div>
          <div className="p-6 rounded-3xl bg-green-500/10 backdrop-blur-md border border-green-500/20 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-green-200 font-medium">Active</span>
            <span className="text-3xl font-bold text-green-400">{stats.active}</span>
          </div>
          <div className="p-6 rounded-3xl bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-yellow-200 font-medium">Idle</span>
            <span className="text-3xl font-bold text-yellow-400">{stats.idle}</span>
          </div>
          <div className="p-6 rounded-3xl bg-red-500/10 backdrop-blur-md border border-red-500/20 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-red-200 font-medium">No Activity</span>
            <span className="text-3xl font-bold text-red-400">{stats.inactive}</span>
          </div>
          <div className="p-6 rounded-3xl bg-neutral-800/60 backdrop-blur-md border border-white/10 flex flex-col gap-1.5 shadow-xl">
            <span className="text-sm text-white/70 font-medium">Dead</span>
            <span className="text-3xl font-bold text-white">{stats.dead}</span>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shadow-xl w-full">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search owner/repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 text-sm w-full"
            />
          </div>

          <div className="w-px h-8 bg-white/10 hidden md:block" />

          {/* Status Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              title="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | RepoStatus)}
              className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-cyan-400/50 text-sm appearance-none min-w-[140px] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Idle">Idle</option>
              <option value="Inactive">Inactive</option>
              <option value="Dead">Dead</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <ArrowUpDown className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
               title="Sort Options"
               value={sortKey}
               onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
               className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-cyan-400/50 text-sm appearance-none min-w-[170px] cursor-pointer"
            >
              <option value="Name">Sort: Name (A-Z)</option>
              <option value="Hackathon Commits">Sort: Hackathon Commits</option>
              <option value="Last Push">Sort: Last Push</option>
              <option value="Contributors">Sort: Contributors</option>
            </select>
          </div>

          <div className="w-px h-8 bg-white/10 hidden md:block" />

          {/* Actions */}
          <div className="flex gap-3 ml-auto items-center">
             <div className="flex flex-col items-end mr-2">
               <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-0.5">Next Refresh</span>
               <span className="text-sm font-mono text-cyan-300 font-medium">
                 {pollStatus === 'frozen' || pollStatus === 'critical' ? '--:--' : formatCountdown(nextPollIn)}
               </span>
             </div>

             <button
               onClick={triggerManualRefresh}
               disabled={pollStatus === 'polling' || pollStatus === 'critical'}
               className="px-4 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-100 font-medium border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
             >
               <RefreshCw className={`w-4 h-4 ${pollStatus === 'polling' ? 'animate-spin' : ''}`} />
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

        {/* Table Container */}
          <div className="w-full bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-md shadow-2xl overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
             <thead>
               <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-wider">
                 <th className="py-5 px-2 font-black text-white/40 text-center w-12">#</th>
                 <th className="py-5 px-4 font-black text-white w-48">Repository</th>
                 <th className="py-5 px-3 font-black text-white w-28">Last Push</th>
                 <th className="py-5 px-2 font-black text-white text-center w-24">Hackathon</th>
                 <th className="py-5 px-2 font-black text-white text-center w-28 whitespace-nowrap">Commit Count</th>
                 <th className="py-5 px-2 font-black text-white text-center w-28 whitespace-nowrap">Contributor</th>
                 <th className="py-5 px-2 font-black text-white w-auto">Last Commit Message</th>
                 <th className="py-5 px-3 font-black text-white text-center w-32">Status</th>
                 <th className="py-5 px-2 font-black text-white text-center w-32">Commit History</th>
                 <th className="py-5 px-4 font-black text-white w-32">Flags</th>
               </tr>
             </thead>
             <tbody>
               {filteredAndSorted.length > 0 ? (
                 filteredAndSorted.map((item, index) => (
                   <RepoRow 
                     key={item.repoKey}
                     index={index}
                     repoKey={item.repoKey}
                     data={item.data}
                     isRefreshing={refreshingRepos.has(item.repoKey)}
                     onViewCommits={setModalRepoKey}
                   />
                 ))
               ) : (
                 <tr>
                  <td colSpan={10} className="py-12 text-center text-white/40 italic">
                     No teams found matching your filters.
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {modalRepoKey && (
        <CommitModal
          repoKey={modalRepoKey}
          pat={pat}
          onClose={() => setModalRepoKey(null)}
        />
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}
