"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { HACKATHON_END, HACKATHON_START } from "../utils/github";

interface CommitModalProps {
  repoKey: string;
  pat: string;
  onClose: () => void;
}

interface CommitItem {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
}

type CommitFilter = "hackathon" | "all";

type LoadState = "idle" | "loading" | "error" | "done";

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const time = new Date(isoString).getTime();
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function CommitModal({ repoKey, pat, onClose }: CommitModalProps) {
  const [filter, setFilter] = useState<CommitFilter>("hackathon");
  const [state, setState] = useState<LoadState>("idle");
  const [commits, setCommits] = useState<CommitItem[]>([]);

  const [owner, repo] = useMemo(() => repoKey.split("/"), [repoKey]);

  const windowStart = useMemo(() => new Date(HACKATHON_START).getTime(), []);
  const windowEnd = useMemo(() => new Date(HACKATHON_END).getTime(), []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchCommits = async () => {
      setState("loading");
      setCommits([]);

      const all: CommitItem[] = [];
      const maxPages = 3;
      const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
      const params = filter === "hackathon"
        ? `?since=${encodeURIComponent(HACKATHON_START)}&until=${encodeURIComponent(HACKATHON_END)}&per_page=100`
        : "?per_page=100";

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (pat) {
        headers.Authorization = `token ${pat}`;
      }

      try {
        for (let page = 1; page <= maxPages; page += 1) {
          const url = `${baseUrl}${params}&page=${page}`;
          const response = await fetch(url, { headers, signal: controller.signal });
          if (!response.ok) {
            throw new Error("commit_fetch_failed");
          }
          const data = (await response.json()) as CommitItem[];
          all.push(...data);
          if (data.length < 100) break;
        }

        if (!isMounted) return;
        setCommits(all);
        setState("done");
      } catch {
        if (!isMounted) return;
        setState("error");
      }
    };

    fetchCommits();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [filter, owner, repo, pat]);

  const headerCountLabel = filter === "hackathon"
    ? `${commits.length} commits in hackathon window`
    : `${commits.length} commits total`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] max-h-[85vh] bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl relative"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
          <div className="flex flex-col gap-1">
            <a
              href={`https://github.com/${repoKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-bold hover:text-cyan-400 transition-colors tracking-tight"
            >
              {repoKey}
            </a>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">{headerCountLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-8 py-4 border-b border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setFilter("hackathon")}
            className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
              filter === "hackathon"
                ? "bg-gradient-to-r from-cyan-500/20 to-orange-500/20 border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                : "bg-black/20 border-white/5 text-white/40 hover:text-white hover:border-white/20"
            }`}
          >
            Hackathon Window
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
              filter === "all"
                ? "bg-gradient-to-r from-cyan-500/20 to-orange-500/20 border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                : "bg-black/20 border-white/5 text-white/40 hover:text-white hover:border-white/20"
            }`}
          >
            Full History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar">
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 text-white/40 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm font-light italic tracking-wide">Syncing intelligence data...</p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center text-red-400/80 font-medium py-20 flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
                <X className="w-6 h-6" />
              </div>
              Failed to synchronize commit history
            </div>
          )}

          {state === "done" && commits.length === 0 && (
            <div className="text-center text-white/30 py-20 italic font-light tracking-wide">
              No activity detected in this window
            </div>
          )}

          {state === "done" && commits.map((commit) => {
            const commitDate = commit.commit.author.date;
            const timestamp = new Date(commitDate).getTime();
            const inWindow = timestamp >= windowStart && timestamp <= windowEnd;
            const authorLogin = commit.author?.login;
            const authorName = authorLogin || commit.commit.author.name || "Unknown";
            const avatarUrl = authorLogin
              ? `https://github.com/${authorLogin}.png?size=24`
              : "https://github.com/ghost.png?size=24";

            return (
              <div
                key={commit.sha}
                className="flex gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all group/item shadow-sm"
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-sm ${inWindow ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]" : "bg-white/10"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-white/90 text-sm leading-relaxed font-light">
                    {commit.commit.message}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-tight">
                    <div className="flex items-center gap-2 text-white/70">
                      <img src={avatarUrl} alt={authorName} className="w-5 h-5 rounded-full ring-1 ring-white/10" />
                      <span>{authorName}</span>
                    </div>
                    <span className="text-white/10">•</span>
                    <span className="text-white/40" title={new Date(commitDate).toISOString()}>{formatRelativeTime(commitDate)}</span>
                    <span className="text-white/10">•</span>
                    <a
                      href={`https://github.com/${owner}/${repo}/commit/${commit.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 transition-colors underline decoration-cyan-400/20 underline-offset-4"
                    >
                      View Node
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
}
