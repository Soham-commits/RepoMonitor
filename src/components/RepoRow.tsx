"use client";

import React, { memo } from "react";
import type { FetchRepoDataResult } from "../utils/github";
import { AlertTriangle, User, Lock, ExternalLink, MessageSquare } from "lucide-react";

interface RepoRowProps {
  index: number;
  repoKey: string;
  data?: FetchRepoDataResult;
  isRefreshing?: boolean;
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

function RepoRowComponent({ index, repoKey, data, isRefreshing = false }: RepoRowProps) {
  const { status, lastPushIso, commitsCount, recentCommitsCount, contributorsCount, lastCommitMessage } = getRepoStatusAndDetails(data);

  // Flags as solid badges
  const flags: Array<{ text: string; color: string }> = [];
  const isPrivateFlag = data?.error === "not_found" || data?.repoInfo?.visibility === "private";
  const isTimeoutFlag = data?.error === "timeout";

  if (isPrivateFlag) {
    flags.push({ text: "PRIVATE", color: "bg-gray-500 text-white" });
  } else if (isTimeoutFlag) {
    flags.push({ text: "TIMEOUT", color: "bg-orange-500 text-black" });
  } else {
    if (commitsCount === 0 && status !== "Loading") {
      flags.push({ text: "NO COMMITS", color: "bg-red-500 text-white" });
    }

    if (contributorsCount === 1) {
      flags.push({ text: "SOLO", color: "bg-yellow-500 text-black" });
    }
  }

  const isPrivateRow = isPrivateFlag;
  const statusText = isPrivateRow ? "PRIVATE" : status === "Timeout" ? "TIMEOUT" : status;

  const relativePush = formatRelativeTime(lastPushIso);
  const truncateMessage = (msg: string | null) => {
    if (!msg) return "";
    const firstLine = msg.split("\n")[0];
    return firstLine.length > 40 ? firstLine.substring(0, 40) + "..." : firstLine;
  };

  return (
    <tr className={`border-b border-white/5 hover:bg-white/[0.05] transition-colors group ${index % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
      {/* Index + Refresh Indicator */}
      <td className="py-6 px-4 text-white/40 font-mono text-xs align-middle whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {isRefreshing && (
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
          )}
          <span>{index + 1}</span>
        </div>
      </td>

      {/* Repository */}
      <td className="py-6 px-4 align-middle min-w-[200px]">
        <a 
          href={`https://github.com/${repoKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-semibold hover:underline transition-all inline-flex items-center gap-2 group/link text-sm"
        >
          {repoKey}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
        </a>
      </td>

      {/* Last Push */}
      <td
        className="py-6 px-4 align-middle whitespace-nowrap"
        title={!isPrivateRow && lastPushIso ? new Date(lastPushIso).toISOString() : undefined}
      >
        {isPrivateRow ? (
          <span className="text-white/20">—</span>
        ) : (
          <span className={`font-mono text-sm font-bold ${relativePush.colorClass}`}>
            {relativePush.text}
          </span>
        )}
      </td>

      {/* Hackathon Commits */}
      <td className="py-6 px-4 align-middle whitespace-nowrap text-center">
        {isPrivateRow ? (
          <span className="text-white/20">—</span>
        ) : (
          <span className={`text-xl font-black font-mono ${commitsCount > 0 ? "text-green-400" : "text-red-400"}`}>
            {status === "Loading" ? "-" : commitsCount}
          </span>
        )}
      </td>

      {/* Recent Activity (30d) */}
      <td className="py-6 px-4 align-middle whitespace-nowrap">
        {isPrivateRow ? (
          <div className="text-center text-white/20">—</div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-white font-bold font-mono">{status === "Loading" ? "—" : recentCommitsCount}</div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">30d activity</div>
          </div>
        )}
      </td>

      {/* Contributors */}
      <td className="py-6 px-4 align-middle whitespace-nowrap text-center text-white font-mono font-medium">
        {isPrivateRow ? "—" : (contributorsCount !== null ? contributorsCount : (status === "Error" ? "?" : "—"))}
      </td>

      {/* Last Commit Message */}
      <td
        className="py-6 px-4 align-middle min-w-[240px] max-w-[300px]"
        title={!isPrivateRow && lastCommitMessage ? lastCommitMessage.replace(/^["']|["']$/g, '') : undefined}
      >
        {isPrivateRow ? (
          <span className="text-white/20 italic text-xs">—</span>
        ) : status === "Loading" ? (
          <span className="text-white/20 italic text-xs">Loading...</span>
        ) : lastCommitMessage ? (
          <p className="text-white/60 italic text-sm truncate">
            {truncateMessage(lastCommitMessage.replace(/^["']|["']$/g, ''))}
          </p>
        ) : (
          <span className="text-red-400/50 italic text-xs">No commits</span>
        )}
      </td>

      {/* Status (Solid Badges) */}
      <td className="py-6 px-4 align-middle whitespace-nowrap">
        <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5
          ${isPrivateRow ? 'bg-gray-600 text-white' : ''}
          ${status === 'Active' ? 'bg-green-500 text-black' : ''}
          ${status === 'Idle' ? 'bg-yellow-400 text-black' : ''}
          ${status === 'Inactive' ? 'bg-red-500 text-white' : ''}
          ${status === 'Dead' ? 'bg-neutral-800 text-white' : ''}
          ${status === 'Timeout' ? 'bg-orange-500 text-black' : ''}
          ${status === 'Error' ? 'bg-gray-600 text-white' : ''}
          ${status === 'Loading' ? 'bg-white/10 text-white/40 border border-white/10' : ''}
        `}>
          {status === 'Active' && <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />}
          {statusText}
        </div>
      </td>

      {/* Flags (Solid Badge Stack) */}
      <td className="py-6 px-4 align-middle whitespace-nowrap">
        <div className="flex flex-col gap-1.5 min-w-[80px]">
          {flags.length === 0 && status !== 'Loading' && <span className="text-white/10 text-center">-</span>}
          {flags.map((flag, i) => (
             <div key={i} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${flag.color}`}>
               <span>{flag.text}</span>
             </div>
          ))}
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
