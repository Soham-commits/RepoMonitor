"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

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

type LoadState = "idle" | "loading" | "error" | "done";

function normalizeRepoKey(repoKey: string): string {
  const trimmed = repoKey.trim().replace(/\/+$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return trimmed;

  const owner = parts[0];
  const cleanRepo = parts[1].replace(/\.git$/, "");
  const repo = cleanRepo.replace(/\.git$/i, "");
  if (!owner || !repo) return trimmed;

  return `${owner}/${repo}`;
}

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
  const [state, setState] = useState<LoadState>("idle");
  const [commits, setCommits] = useState<CommitItem[]>([]);

  const normalizedRepoKey = useMemo(() => normalizeRepoKey(repoKey), [repoKey]);
  const [owner, repo] = useMemo(() => normalizedRepoKey.split("/"), [normalizedRepoKey]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchCommits = async () => {
      setState("loading");
      setCommits([]);

      const all: CommitItem[] = [];
      const maxPages = 3;
      const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
      const params = "?per_page=100";

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
  }, [owner, repo, pat]);

  const headerCountLabel = `${commits.length} commits total`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] max-h-[85vh] bg-white/10 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl relative"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2CFF]/50 to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-white/15">
          <div className="flex flex-col gap-1">
            <a
              href={`https://github.com/${normalizedRepoKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-bold hover:text-[#1E2CFF] transition-colors tracking-tight"
            >
              {normalizedRepoKey}
            </a>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">{headerCountLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full border border-white/15 text-white/45 hover:text-white hover:border-white/30 hover:bg-white/8 transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar">
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 text-white/40 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#1E2CFF]" />
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
              No commit activity found for this repository
            </div>
          )}

          {state === "done" && commits.map((commit) => {
            const commitDate = commit.commit.author.date;
            const authorLogin = commit.author?.login;
            const authorName = authorLogin || commit.commit.author.name || "Unknown";
            const avatarUrl = authorLogin
              ? `https://github.com/${authorLogin}.png?size=24`
              : "https://github.com/ghost.png?size=24";

            return (
              <div
                key={commit.sha}
                className="flex gap-4 p-4 rounded-2xl border border-white/15 bg-white/8 hover:bg-white/10 hover:border-white/30 transition-all group/item shadow-sm"
              >
                <div className="mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-sm bg-[#1E2CFF] shadow-[0_0_8px_rgba(30,44,255,0.45)]" />
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
                      className="text-[#1E2CFF] hover:text-[#B06CFF] transition-colors underline decoration-[#1E2CFF]/20 underline-offset-4"
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
          background: #6A3DFF0D;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #B06CFF1A;
        }
      `}} />
    </div>
  );
}
