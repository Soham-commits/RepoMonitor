// src/hooks/usePoller.ts
// React hook that owns the poller Web Worker.
// Pure logic — no UI.

import { useCallback, useEffect, useRef, useState } from "react";
import { getRateLimitState } from "../utils/github";
import type { FetchRepoDataResult, RateLimitState } from "../utils/github";
import type {
  WorkerInMessage,
  WorkerOutMessage,
} from "../workers/poller.worker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PollStatus = "idle" | "polling" | "degraded" | "critical" | "frozen";

export interface PollerConfig {
  repos: string[]; // "owner/repo" strings
  pat?: string;
}

export interface PollerState {
  repoStates: Map<string, FetchRepoDataResult>;
  rateLimitState: RateLimitState;
  hasFreshRateLimit: boolean;
  pollStatus: PollStatus;
  lastPollTime: Date | null;
  nextPollIn: number; // seconds countdown (0–480)
  refreshingRepos: Set<string>; // repos currently being refreshed (for per-row indicator)
}

export interface PollerActions {
  triggerManualRefresh: () => void;
  retryNow: () => void;
  startPolling: (config: PollerConfig) => void;
  stopPolling: () => void;
}

export type UsePollerReturn = PollerState & PollerActions;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_SECONDS = 480; // 8 minutes

function normalizeRepoName(repoName: string): string {
  const cleanRepo = repoName.replace(/\.git$/, "");
  return cleanRepo.replace(/\.git$/i, "");
}

function normalizeRepoKey(repoKey: string): string | null {
  const trimmed = repoKey.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const owner = parts[0].trim();
  const repo = normalizeRepoName(parts[1].trim());
  if (!owner || !repo) return null;

  return `${owner}/${repo}`;
}

function normalizeRepoList(repos: string[]): string[] {
  return Array.from(
    new Set(
      repos
        .map((repo) => normalizeRepoKey(repo))
        .filter((repo): repo is string => Boolean(repo))
    )
  );
}

// Repos with zero hackathon commits whose last-known status was inactive get
// skipped in degraded mode.
function isRepoActive(result: FetchRepoDataResult): boolean {
  if (result.error) return false;
  // If full commits is known and empty, and delta commits are empty → inactive
  const fullEmpty =
    result.fullCommits !== null && result.fullCommits.length === 0;
  const deltaEmpty = result.deltaCommits.length === 0;
  return !(fullEmpty && deltaEmpty);
}

/**
 * ⚡ Priority sort: Active > Idle > Loading > Inactive/Error
 * Active and idle repos go first so the user sees meaningful updates faster.
 */
function prioritizeRepos(
  repos: string[],
  statesRef: Map<string, FetchRepoDataResult>
): string[] {
  const active: string[] = [];
  const idle: string[] = [];
  const unknown: string[] = [];
  const inactive: string[] = [];

  for (const repo of repos) {
    const data = statesRef.get(repo);
    if (!data) {
      unknown.push(repo);
      continue;
    }
    if (data.error) {
      inactive.push(repo);
      continue;
    }

    const pushed = data.repoInfo?.pushed_at;
    if (!pushed) {
      inactive.push(repo);
      continue;
    }

    const diffMins = (Date.now() - new Date(pushed).getTime()) / (1000 * 60);
    if (diffMins < 60) {
      active.push(repo);
    } else if (diffMins <= 180) {
      idle.push(repo);
    } else {
      inactive.push(repo);
    }
  }

  // Active and idle first → then unknown (first-time) → then inactive
  return [...active, ...idle, ...unknown, ...inactive];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePoller(initialConfig?: PollerConfig): UsePollerReturn {
  // ---- Stable config ref (avoid stale closures in callbacks) ----
  const configRef = useRef<PollerConfig>(
    initialConfig
      ? { ...initialConfig, repos: normalizeRepoList(initialConfig.repos) }
      : { repos: [], pat: undefined }
  );

  // ---- Worker ref ----
  const workerRef = useRef<Worker | null>(null);

  // ---- Request lock flag (prevents simultaneous polls) ----
  const pollingLockRef = useRef(false);

  // ---- React state ----
  const [repoStates, setRepoStates] = useState<Map<string, FetchRepoDataResult>>(
    new Map()
  );
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    remaining: 5000,
    reset: 0,
    limit: 5000,
  });
  const [hasFreshRateLimit, setHasFreshRateLimit] = useState(false);
  const [pollStatus, setPollStatus] = useState<PollStatus>("idle");
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number>(POLL_INTERVAL_SECONDS);
  const [refreshingRepos, setRefreshingRepos] = useState<Set<string>>(new Set());

  const rateLimitRef = useRef<RateLimitState>({
    remaining: 5000,
    reset: 0,
    limit: 5000,
  });
  useEffect(() => {
    rateLimitRef.current = rateLimitState;
  }, [rateLimitState]);

  // ---- Countdown timer ref ----
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether countdown is frozen (critical rate limit)
  const countdownFrozenRef = useRef(false);

  // ---- Keep a stable snapshot of latest repoStates for soft-cap reads ----
  const repoStatesRef = useRef<Map<string, FetchRepoDataResult>>(new Map());
  useEffect(() => {
    repoStatesRef.current = repoStates;
  }, [repoStates]);

  // ---- Keep latest pollStatus accessible inside callbacks ----
  const pollStatusRef = useRef<PollStatus>("idle");
  useEffect(() => {
    pollStatusRef.current = pollStatus;
  }, [pollStatus]);

  // ---------------------------------------------------------------------------
  // Countdown helpers
  // ---------------------------------------------------------------------------

  function clearCountdown() {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown(onZero: () => void) {
    clearCountdown();
    countdownFrozenRef.current = false;
    setNextPollIn(POLL_INTERVAL_SECONDS);

    let remaining = POLL_INTERVAL_SECONDS;

    countdownRef.current = setInterval(() => {
      if (countdownFrozenRef.current) return;

      remaining -= 1;
      setNextPollIn(remaining);

      if (remaining <= 0) {
        clearCountdown();
        onZero();
      }
    }, 1000);
  }

  function freezeCountdown() {
    countdownFrozenRef.current = true;
  }

  function resetCountdown() {
    countdownFrozenRef.current = false;
    setNextPollIn(POLL_INTERVAL_SECONDS);
  }

  // ---------------------------------------------------------------------------
  // Send typed message to worker
  // ---------------------------------------------------------------------------

  function sendToWorker(msg: WorkerInMessage) {
    workerRef.current?.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // Dispatch a poll — builds repo list applying soft cap in degraded mode
  // ---------------------------------------------------------------------------

  const dispatchPoll = useCallback(() => {
    if (!workerRef.current) return;
    if (pollingLockRef.current) return; // already polling — ignore

    const { pat } = configRef.current;
    const repos = normalizeRepoList(configRef.current.repos);

    // Soft cap: in degraded mode skip repos with known zero hackathon commits
    let reposToFetch = repos;
    if (pollStatusRef.current === "degraded") {
      reposToFetch = repos.filter((r) => {
        const state = repoStatesRef.current.get(r);
        if (!state) return true; // unknown — include
        return isRepoActive(state);
      });
    }

    // ⚡ Optimization 1: Priority sort — Active/Idle repos first
    reposToFetch = prioritizeRepos(reposToFetch, repoStatesRef.current);

    pollingLockRef.current = true;

    // ⚡ Optimization 3: Optimistic UI — do NOT reset repoStates.
    // Keep showing last valid data. Only update individual rows on REPO_UPDATE.
    // Just mark status as polling for the refresh button spinner.
    setPollStatus((prev) =>
      prev === "degraded" ? "degraded" : "polling"
    );

    // Mark ALL repos as refreshing (will be cleared individually on REPO_UPDATE)
    setRefreshingRepos(new Set(reposToFetch));

    sendToWorker({
      type: "START",
      repos: reposToFetch,
      pat: pat ?? "",
      rateLimitRemaining: rateLimitState.remaining,
    });
  }, [rateLimitState.remaining]);

  const recoverFromRateLimitIfNeeded = useCallback(
    async (runImmediatePoll = false) => {
      const pat = configRef.current.pat;
      const latest = await getRateLimitState(pat);
      if (!latest) return;

      setRateLimitState(latest);
      setHasFreshRateLimit(true);

      if (latest.remaining > 1000) {
        pollingLockRef.current = false;
        setPollStatus("idle");
        setRefreshingRepos(new Set());
        resetCountdown();
        clearCountdown();

        if (runImmediatePoll) {
          dispatchPoll();
        } else {
          startCountdown(dispatchPoll);
        }
      }
    },
    [dispatchPoll]
  );

  // ---------------------------------------------------------------------------
  // Worker message handler
  // ---------------------------------------------------------------------------

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case "REPO_UPDATE": {
          const { repo, data } = msg;
          // Surgically update only this repo — other repos do NOT re-render
          // because we create a new Map reference with the same entries.
          setRepoStates((prev) => {
            const next = new Map(prev);
            next.set(repo, data);
            return next;
          });

          // ⚡ Remove this repo from the refreshing set (per-row freshness indicator)
          setRefreshingRepos((prev) => {
            const next = new Set(prev);
            next.delete(repo);
            return next;
          });

          // Mirror rate limit from the latest data payload
          if (data.rateLimit) {
            setRateLimitState(data.rateLimit);
            setHasFreshRateLimit(true);
          }
          break;
        }

        case "BATCH_START": {
          // Worker is about to process these repos — ensure they're in the refreshing set
          setRefreshingRepos((prev) => {
            const next = new Set(prev);
            for (const r of msg.repos) next.add(r);
            return next;
          });
          break;
        }

        case "POLL_COMPLETE": {
          pollingLockRef.current = false;
          setLastPollTime(new Date(msg.timestamp));

          const prevRateLimit = rateLimitRef.current;
          const nextRateLimit = msg.rateLimitState;
          setRateLimitState(msg.rateLimitState);
          setHasFreshRateLimit(true);

          // Clear all refreshing indicators
          setRefreshingRepos(new Set());

          // Only reset to polling/idle if not in a critical/frozen state
          setPollStatus((prev) => {
            if (prev === "critical" || prev === "frozen") return prev;
            if (prev === "degraded") return "degraded";
            return "idle";
          });

          const recoveredAfterReset =
            prevRateLimit.remaining < 500 && nextRateLimit.remaining > 4000;

          if (recoveredAfterReset) {
            setPollStatus("idle");
            resetCountdown();
            clearCountdown();
            startCountdown(dispatchPoll);
            break;
          }

          startCountdown(dispatchPoll);
          break;
        }

        case "RATE_LIMIT_WARNING": {
          setPollStatus("degraded");
          break;
        }

        case "RATE_LIMIT_CRITICAL": {
          pollingLockRef.current = false;
          setPollStatus("critical");
          setRefreshingRepos(new Set()); // Clear indicators
          freezeCountdown();
          break;
        }
      }
    },
    [dispatchPoll]
  );

  // ---------------------------------------------------------------------------
  // Spawn / terminate the worker
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Spawn worker
    const worker = new Worker(
      new URL("../workers/poller.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current = worker;
    worker.addEventListener("message", handleWorkerMessage);

    worker.addEventListener("error", () => {
      // Worker-level uncaught error → freeze and preserve state
      pollingLockRef.current = false;
      setPollStatus("frozen");
      setRefreshingRepos(new Set());
      clearCountdown();
    });

    // Trigger first poll immediately
    dispatchPoll();
    void recoverFromRateLimitIfNeeded(false);

    return () => {
      // Cleanup on unmount
      clearCountdown();
      worker.removeEventListener("message", handleWorkerMessage);
      worker.terminate();
      workerRef.current = null;
      pollingLockRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Public Actions
  // ---------------------------------------------------------------------------

  /**
   * Manually trigger an immediate poll.
   * ⚡ Does NOT clear ETag cache — repos with no changes return 304 instantly.
   * ⚡ Does NOT reset repoStates — shows last valid data while refreshing.
   * Silently ignored if a poll is already running.
   */
  const triggerManualRefresh = useCallback(() => {
    if (pollingLockRef.current) return; // request lock — ignore

    // Cancel any current poll in the worker
    sendToWorker({ type: "STOP" });

    // Reset lock so dispatchPoll can proceed
    pollingLockRef.current = false;

    // Reset countdown display
    resetCountdown();
    clearCountdown();

    // Kick off immediately — NO cache clearing, NO state resetting
    dispatchPoll();
  }, [dispatchPoll]);

  const retryNow = useCallback(() => {
    void recoverFromRateLimitIfNeeded(true);
  }, [recoverFromRateLimitIfNeeded]);

  /**
   * Start (or restart) polling with a new config.
   */
  const startPolling = useCallback(
    (config: PollerConfig) => {
      configRef.current = {
        ...config,
        repos: normalizeRepoList(config.repos),
      };

      // Stop any current poll
      sendToWorker({ type: "STOP" });
      pollingLockRef.current = false;

      clearCountdown();
      resetCountdown();
      setPollStatus("idle");

      dispatchPoll();
    },
    [dispatchPoll]
  );

  /**
   * Stop all polling and freeze the countdown.
   */
  const stopPolling = useCallback(() => {
    sendToWorker({ type: "STOP" });
    pollingLockRef.current = false;
    clearCountdown();
    setPollStatus("idle");
    setNextPollIn(POLL_INTERVAL_SECONDS);
    setRefreshingRepos(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // Handle network-level failures surfaced via worker error
  // ---------------------------------------------------------------------------
  // (Already handled in the "error" event listener above — frozen status
  //  preserves the last valid repoStates since we never clear that map.)

  return {
    repoStates,
    rateLimitState,
    hasFreshRateLimit,
    pollStatus,
    lastPollTime,
    nextPollIn,
    refreshingRepos,
    triggerManualRefresh,
    retryNow,
    startPolling,
    stopPolling,
  };
}
