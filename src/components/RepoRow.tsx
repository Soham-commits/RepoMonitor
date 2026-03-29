"use client";

import React, { memo, useEffect, useState } from "react";
import type { FetchRepoDataResult } from "../utils/github";
import { AlertTriangle, User, Lock, ExternalLink, MessageSquare } from "lucide-react";

interface RepoRowProps {
  index: number;
  repoKey: string;
  data?: FetchRepoDataResult;
  isRefreshing?: boolean;
  onViewCommits?: (repoKey: string) => void;
}

export type RepoStatus = "Active" | "Idle" | "Inactive" | "Dead" | "Timeout" | "Error" | "Loading";

export function getRepoStatusAndDetails(data?: FetchRepoDataResult): {
  status: RepoStatus;
  lastPushIso: string | null;
  commitsCount: number; // Hackathon window
  recentCommitsCount: number; // Last 30d total
  contributorsCount: number | null;
  lastCommitMessage: string | null;
} {
  if (!data) return { status: "Loading", lastPushIso: null, commitsCount: 0, recentCommitsCount: 0, contributorsCount: null, lastCommitMessage: null };
  if (data.error === "timeout") return { status: "Timeout", lastPushIso: null, commitsCount: 0, recentCommitsCount: 0, contributorsCount: null, lastCommitMessage: null };
  if (data.error) return { status: "Error", lastPushIso: null, commitsCount: 0, recentCommitsCount: 0, contributorsCount: null, lastCommitMessage: null };

  const lastPushIso = data.repoInfo?.pushed_at || null;
  const commitsCount = (data.fullCommits ? data.fullCommits.length : 0) + (data.deltaCommits ? data.deltaCommits.length : 0);
  const recentCommitsCount = data.recentCommits?.length || 0;
  const contributorsCount = data.contributorCount;
  
  // Last commit message from recentCommits (most recent first usually from GitHub API)
  const lastCommitMessage = data.recentCommits?.[0]?.commit.message || null;

  let status: RepoStatus = "Inactive";
  
  if (commitsCount === 0 && status !== "Loading") {
    status = "Dead";
  } else if (lastPushIso) {
    const pushed = new Date(lastPushIso).getTime();
    const now = Date.now();
    const diffMins = (now - pushed) / (1000 * 60);

    if (diffMins < 60) {
      status = "Active";
    } else if (diffMins <= 180) {
      status = "Idle";
    } else {
      status = "Inactive";
    }
  } else if (!lastPushIso) {
    status = "Error"; // No info available
  }

  return { status, lastPushIso, commitsCount, recentCommitsCount, contributorsCount, lastCommitMessage };
}

function formatRelativeTime(isoString: string | null): { text: string; colorClass: string } {
  if (!isoString) return { text: "N/A", colorClass: "text-white/40" };
  
  const pushed = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - pushed;
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let text = "";
  if (diffMins < 1) text = "Just now";
  else if (diffMins < 60) text = `${diffMins}m ago`;
  else if (diffHours < 24) text = `${diffHours}h ago`;
  else text = `${diffDays}d ago`;

  let colorClass = "text-red-400";
  if (diffMins < 60) colorClass = "text-green-400";
  else if (diffMins <= 180) colorClass = "text-yellow-400";

  return { text, colorClass };
}

function RepoRowComponent({ index, repoKey, data, isRefreshing = false, onViewCommits }: RepoRowProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const { status, lastPushIso, commitsCount, recentCommitsCount, contributorsCount, lastCommitMessage } = getRepoStatusAndDetails(data);

  // Flags as solid badges
  const flags: Array<{ text: string; color: string; title?: string }> = [];
  const isPrivateFlag = data?.error === "not_found" || data?.repoInfo?.visibility === "private";
  const isTimeoutFlag = data?.error === "timeout";

  if (isPrivateFlag) {
    flags.push({ text: "PRIVATE", color: "bg-gray-500 text-white" });
  } else {
    if (isTimeoutFlag) {
      flags.push({ text: "TIMEOUT", color: "bg-orange-500 text-black" });
    }

    if (commitsCount === 0 && status !== "Loading") {
      flags.push({
        text: "NO COMMITS",
        color: "bg-red-500 text-white",
        title: lastPushIso ? `Last push: ${lastPushIso}` : undefined,
      });
    }

    if (contributorsCount === 1) {
      flags.push({ text: "SOLO", color: "bg-yellow-500 text-black" });
    }
  }

  const isPrivateRow = isPrivateFlag;
  const statusText = isPrivateRow ? "PRIVATE" : status === "Timeout" ? "TIMEOUT" : status;
  const [ownerName, repoName] = repoKey.split("/");

  const relativePush = formatRelativeTime(lastPushIso);

  return (
    <tr className={`border-b border-white/5 hover:bg-white/[0.05] transition-colors group ${index % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
      {/* Index + Refresh Indicator */}
      <td className="py-6 px-2 text-white/40 font-mono text-[10px] align-middle whitespace-nowrap text-center">
        <div className="flex items-center justify-center gap-1">
          {isRefreshing && (
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
          )}
          <span className="opacity-50">{index + 1}</span>
        </div>
      </td>

      {/* Repository */}
      <td className="py-6 px-4 align-middle">
        <a 
          href={`https://github.com/${repoKey}`}
          target="_blank"
          rel="noopener noreferrer"
          title={repoKey}
          className="text-white font-bold hover:text-cyan-400 transition-all inline-flex items-center gap-1.5 text-sm tracking-tight"
        >
          <span className="leading-tight">
            <span className="block text-white/85">{ownerName}/</span>
            <span className="block text-white">{repoName || repoKey}</span>
          </span>
          <ExternalLink className="w-3 h-3 text-cyan-400" />
        </a>
      </td>

      {/* Last Activity */}
      <td
        className="py-6 px-3 align-middle whitespace-nowrap"
        title={!isPrivateRow && lastPushIso ? new Date(lastPushIso).toISOString() : undefined}
      >
        {isPrivateRow ? (
          <span className="text-white/10">—</span>
        ) : (
          <span className={`font-mono text-xs font-bold ${relativePush.colorClass}`}>
            {relativePush.text}
          </span>
        )}
      </td>

      {/* Commit Volume */}
      <td className="py-6 px-2 align-middle whitespace-nowrap text-center">
        {isPrivateRow ? (
          <span className="text-white/10">—</span>
        ) : (
          <span className={`text-lg font-black font-mono tracking-tighter ${commitsCount > 0 ? "text-green-400" : "text-red-400"}`}>
            {status === "Loading" ? "-" : commitsCount}
          </span>
        )}
      </td>

      {/* 30D Pulse */}
      <td className="py-6 px-2 align-middle whitespace-nowrap text-center">
        {isPrivateRow ? (
          <span className="text-white/10">—</span>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-white font-black font-mono text-base">{status === "Loading" ? "—" : recentCommitsCount}</span>
          </div>
        )}
      </td>

      {/* Contributor */}
      <td className="py-6 px-2 align-middle whitespace-nowrap text-center text-white font-mono font-bold text-base">
        {isPrivateRow ? <span className="text-white/10">—</span> : (contributorsCount !== null ? contributorsCount : (status === "Error" ? "?" : "—"))}
      </td>

      {/* Last Commit Message (Limited to 2 lines) */}
      <td
        className="py-6 px-2 align-middle"
        title={!isPrivateRow && lastCommitMessage ? lastCommitMessage.replace(/^["']|["']$/g, '') : undefined}
      >
        {isPrivateRow ? (
          <span className="text-white/10 italic text-[10px]">—</span>
        ) : status === "Loading" ? (
          <span className="text-white/20 italic text-[10px] animate-pulse">Scanning...</span>
        ) : lastCommitMessage ? (
          <p className="text-white/80 italic text-xs font-light leading-relaxed whitespace-normal break-words line-clamp-2">
            {lastCommitMessage.replace(/^["']|["']$/g, '')}
          </p>
        ) : (
          <span className="text-red-400/30 italic text-[10px] tracking-wide uppercase font-light">No logs</span>
        )}
      </td>

      {/* Status */}
      <td className="py-6 px-3 align-middle whitespace-nowrap">
        <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5
          ${isPrivateRow ? 'bg-gray-800 text-white/50 border border-white/5' : ''}
          ${status === 'Active' ? 'bg-green-500 text-black' : ''}
          ${status === 'Idle' ? 'bg-yellow-400 text-black' : ''}
          ${status === 'Inactive' ? 'bg-red-500 text-white' : ''}
          ${status === 'Dead' ? 'bg-neutral-900 text-white/40 border border-white/5' : ''}
          ${status === 'Timeout' ? 'bg-orange-500 text-black' : ''}
          ${status === 'Error' ? 'bg-red-900/50 text-red-200 border border-red-500/30' : ''}
          ${status === 'Loading' ? 'bg-white/5 text-white/20 border border-white/10' : ''}
        `}>
          {statusText}
        </div>
      </td>

      {/* History Icon */}
      <td className="py-6 px-2 align-middle whitespace-nowrap text-center">
        <button
          type="button"
          onClick={() => onViewCommits?.(repoKey)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-white/10 text-white/30 hover:text-cyan-400 hover:border-cyan-400/60 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </td>

      {/* Flags */}
      <td className="py-6 px-4 align-middle">
        <div className="flex flex-wrap gap-1 min-w-[80px]">
          {flags.map((flag, i) => (
             <span
               key={i}
               title={flag.title}
               className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${flag.color} border-black/10`}
             >
               {flag.text}
             </span>
          ))}
          {flags.length === 0 && status !== 'Loading' && <span className="text-white/10 font-mono text-[10px]">—</span>}
        </div>
      </td>
    </tr>
  );
}

export const RepoRow = memo(RepoRowComponent, (prev, next) => {
  return (
    prev.repoKey === next.repoKey && 
    prev.data === next.data && 
    prev.index === next.index &&
    prev.isRefreshing === next.isRefreshing
  );
});
