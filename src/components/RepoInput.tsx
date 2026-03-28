"use client";

import React, { useState, useMemo } from "react";
import { fetchRepoInfo } from "../utils/github";
import { StarButton } from "./StarButton";
import { Flame, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";

export interface RepoInputProps {
  onStart: (repos: string[], pat: string) => void;
}

type ValidationStatus = "idle" | "validating" | "done";

interface ParsedUrl {
  original: string;
  owner: string;
  repo: string;
  isValidFormat: boolean;
}

interface ValidationResult {
  url: string;
  owner?: string;
  repo?: string;
  status: "valid" | "not_found_or_private" | "invalid_format" | "rate_limited" | "error";
  reason?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRepoUrl(input: string): ParsedUrl {
  let url = input.trim();
  // Strip trailing slashes and .git
  url = url.replace(/\/+$/, "").replace(/\.git$/, "");
  
  const parsed = {
    original: input,
    owner: "",
    repo: "",
    isValidFormat: false,
  };

  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const target = new URL(url);
      if (target.hostname !== "github.com") return parsed;
      const parts = target.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        parsed.owner = parts[0];
        parsed.repo = parts[1];
        parsed.isValidFormat = true;
      }
    } else if (url.startsWith("github.com/")) {
      const parts = url.substring("github.com/".length).split("/").filter(Boolean);
      if (parts.length >= 2) {
        parsed.owner = parts[0];
        parsed.repo = parts[1];
        parsed.isValidFormat = true;
      }
    } else {
      const parts = url.split("/").filter(Boolean);
      if (parts.length === 2) {
        parsed.owner = parts[0];
        parsed.repo = parts[1];
        parsed.isValidFormat = true;
      }
    }
  } catch {
    // URL parsing failed
  }

  return parsed;
}

export function RepoInput({ onStart }: RepoInputProps) {
  const [pat, setPat] = useState("");
  const [repoText, setRepoText] = useState("");
  
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const rawLines = useMemo(() => {
    return repoText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [repoText]);

  const handleValidate = async () => {
    if (rawLines.length === 0) return;

    setStatus("validating");
    setResults([]);
    setProgress({ current: 0, total: rawLines.length });

    const currentResults: ValidationResult[] = [];
    const ToValidate: ParsedUrl[] = [];

    // 1. Initial Format Check
    for (const line of rawLines) {
      const parsed = parseRepoUrl(line);
      if (!parsed.isValidFormat) {
        currentResults.push({
          url: line,
          status: "invalid_format",
          reason: "Invalid GitHub URL format",
        });
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }));
      } else {
        ToValidate.push(parsed);
      }
    }

    setResults([...currentResults]);

    // 2. Validate valid formats in batches
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 500;

    for (let i = 0; i < ToValidate.length; i += BATCH_SIZE) {
      const batch = ToValidate.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (parsed) => {
        const { owner, repo, original } = parsed;
        try {
          const res = await fetchRepoInfo(owner, repo, pat || undefined);
          let itemResult: ValidationResult = {
            url: original,
            owner,
            repo,
            status: "error",
          };

          if ("error" in res) {
            if (res.error === "not_found") {
              itemResult.status = "not_found_or_private";
              itemResult.reason = "Repository not found or private (requires PAT)";
            } else if (res.error === "rate_limited") {
              itemResult.status = "rate_limited";
              itemResult.reason = "Rate limit exceeded";
            } else {
              itemResult.status = "error";
              itemResult.reason = "Network or unknown error";
            }
          } else {
            itemResult.status = "valid";
          }
          return itemResult;
        } catch {
          return {
            url: original,
            owner,
            repo,
            status: "error",
            reason: "Network error",
          } as ValidationResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      currentResults.push(...batchResults);
      
      setResults([...currentResults]);
      setProgress((prev) => ({ ...prev, current: prev.current + batch.length }));

      if (i + BATCH_SIZE < ToValidate.length) {
        await delay(BATCH_DELAY);
      }
    }

    setStatus("done");
  };

  const handleStart = () => {
    const validRepos = results
      .filter((r) => r.status === "valid" && r.owner && r.repo)
      .map((r) => `${r.owner}/${r.repo}`);
    
    // Pass valid repos to parent
    onStart(validRepos, pat);
    
    // Clear state
    setResults([]);
    setStatus("idle");
    setRepoText("");
    setPat("");
  };

  const validCount = results.filter((r) => r.status === "valid").length;
  const failedCount = results.filter((r) => r.status !== "valid").length;

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-black flex flex-col items-center py-12 px-6 selection:bg-cyan-500/30 font-sans">
      {/* Background Gradient Mesh equivalent to theme */}
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

      {/* Header */}
      <div className="z-10 text-center mb-10 flex flex-col items-center pt-8">
        <div className="flex items-center group cursor-pointer mb-4">
          <Flame className="w-8 h-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
          Ignisia <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">2026</span>
        </h1>
        <p className="text-white/60 font-light text-sm">Repo Intelligence Dashboard Setup</p>
      </div>

      {/* Main Card */}
      <div className="z-10 w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        <div className="space-y-6">
          {/* PAT Input */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              GitHub Personal Access Token <span className="text-white/40 font-normal">(Optional, required for private repos)</span>
            </label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              disabled={status === "validating"}
              className="w-full bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 disabled:opacity-50 transition-all font-mono text-sm shadow-inner"
            />
          </div>

          {/* Repo Input */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-medium text-white/80">
                Team Repositories
              </label>
              <span className="text-xs text-white/50 font-mono">
                {rawLines.length} URLs detected
              </span>
            </div>
            <textarea
              placeholder="Paste one GitHub repo URL per line...&#10;e.g. https://github.com/owner/repo&#10;github.com/owner/repo2&#10;owner/repo3"
              value={repoText}
              onChange={(e) => setRepoText(e.target.value)}
              disabled={status === "validating"}
              className="w-full h-64 bg-black/40 border-2 border-white/10 focus:border-cyan-400/50 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-0 resize-y disabled:opacity-50 transition-all font-mono text-sm leading-relaxed shadow-inner"
            />
          </div>

          {/* Validation Actions */}
          <div className="flex items-center justify-between pt-6">
            <button
              onClick={handleValidate}
              disabled={rawLines.length === 0 || status === "validating"}
              className="px-10 py-4 rounded-full bg-transparent border-2 border-white/30 text-white font-medium text-sm transition-all duration-300 hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-white/30 disabled:hover:text-white cursor-pointer backdrop-blur-sm flex items-center gap-2"
            >
              {status === "validating" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Validating...
                </>
              ) : (
                "Validate Repos"
              )}
            </button>

            <StarButton 
              onClick={handleStart} 
              disabled={validCount === 0 || status !== "done"}
              className="px-8"
            >
              Start Monitoring
            </StarButton>
          </div>
        </div>

        {/* Validation Progress & Results */}
        <AnimatePresence>
          {status !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-8 border-t border-white/10"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-medium">Validation Results</h3>
                {status === "done" && (
                  <div className="text-sm">
                    <span className="text-green-400 font-semibold">{validCount} valid</span>
                    {failedCount > 0 && (
                      <>
                        <span className="text-white/30 mx-2">|</span>
                        <span className="text-red-400 font-semibold">{failedCount} failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {status === "validating" && (
                <div className="w-full bg-white/5 rounded-full h-2 mb-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-orange-400 h-2 transition-all duration-300 ease-out"
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              )}

              {/* Results List */}
              <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg text-sm border ${
                      r.status === "valid"
                        ? "bg-green-500/10 border-green-500/20 text-green-100"
                        : "bg-red-500/10 border-red-500/20 text-red-100"
                    }`}
                  >
                    {r.status === "valid" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    ) : r.status === "invalid_format" ? (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-mono opacity-90">{r.url}</p>
                      {r.reason && <p className="text-xs opacity-70 mt-1">{r.reason}</p>}
                    </div>
                  </div>
                ))}

                {results.length === 0 && status === "validating" && (
                  <div className="text-white/40 text-sm text-center py-6 italic font-light">
                    Initializing validation checks...
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
