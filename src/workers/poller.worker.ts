// src/workers/poller.worker.ts
// Runs in a Web Worker thread — no DOM, no React.
// Imports github.ts utilities directly (bundler resolves this at build time).

import {
  fetchRepoData,
  type FetchRepoDataResult,
  type RateLimitState,
} from "../utils/github";

// ---------------------------------------------------------------------------
// Message Contract
// ---------------------------------------------------------------------------

/** Messages received from the main thread */
export type WorkerInMessage =
  | {
      type: "START";
      repos: string[]; // "owner/repo" format — already priority-sorted by main thread
      pat: string;
      rateLimitRemaining: number;
    }
  | { type: "STOP" };

/** Messages posted to the main thread */
export type WorkerOutMessage =
  | { type: "REPO_UPDATE"; repo: string; data: FetchRepoDataResult }
  | { type: "POLL_COMPLETE"; timestamp: string; rateLimitState: RateLimitState }
  | { type: "RATE_LIMIT_WARNING" }
  | { type: "RATE_LIMIT_CRITICAL" }
  | { type: "BATCH_START"; repos: string[] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 800;
const RATE_LIMIT_CRITICAL_THRESHOLD = 500;
const RATE_LIMIT_WARNING_THRESHOLD = 1000;

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

let currentController: AbortController | null = null;
let isPolling = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(msg: WorkerOutMessage): void {
  (self as unknown as Worker).postMessage(msg);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRepo(repoStr: string): { owner: string; repo: string } | null {
  const parts = repoStr.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

// ---------------------------------------------------------------------------
// Core Poll Loop
// ---------------------------------------------------------------------------

async function runPoll(
  repos: string[],
  pat: string,
  initialRemaining: number,
  signal: AbortSignal
): Promise<void> {
  isPolling = true;
  let rateLimitRemaining = initialRemaining;
  let lastRateLimitState: RateLimitState = {
    remaining: initialRemaining,
    reset: 0,
    limit: 5000,
  };

  // Split repos into batches of BATCH_SIZE
  const batches: string[][] = [];
  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    batches.push(repos.slice(i, i + BATCH_SIZE));
  }

  outer: for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    // ⚡ Optimization: First batch fires immediately with NO delay.
    // Only add 800ms inter-batch delay from batch 2 onwards.
    if (batchIdx > 0) {
      await delay(BATCH_DELAY_MS);
    }

    if (signal.aborted) break;

    const batch = batches[batchIdx];

    // Notify main thread which repos are about to be refreshed (for per-row indicator)
    post({ type: "BATCH_START", repos: batch });

    // ⚡ Optimization: First batch runs all repos in PARALLEL.
    // Subsequent batches run sequentially to be gentler on rate limits.
    if (batchIdx === 0) {
      // Fire all repos in batch 0 simultaneously
      const promises = batch.map(async (repoStr) => {
        if (signal.aborted) return;

        if (rateLimitRemaining < RATE_LIMIT_CRITICAL_THRESHOLD) {
          return; // Will be caught after Promise.all
        }

        const parsed = parseRepo(repoStr);
        if (!parsed) return;

        const { owner, repo } = parsed;

        let result: FetchRepoDataResult;
        try {
          result = await fetchRepoData(owner, repo, pat || undefined, signal);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("network_error")) {
            post({
              type: "REPO_UPDATE",
              repo: repoStr,
              data: {
                repoInfo: null,
                deltaCommits: [],
                recentCommits: [],
                fullCommits: null,
                contributorCount: null,
                contributors: null,
                rateLimit: lastRateLimitState,
                tier: 1,
                error: "not_found",
              },
            });
            return;
          }
          if (signal.aborted) return;
          return;
        }

        if (signal.aborted) return;

        // Update shared rate limit tracking (slightly racy but fine for thresholds)
        rateLimitRemaining = Math.min(rateLimitRemaining, result.rateLimit.remaining);
        lastRateLimitState = result.rateLimit;

        post({ type: "REPO_UPDATE", repo: repoStr, data: result });
      });

      await Promise.all(promises);

      // Check thresholds after parallel batch completes
      if (rateLimitRemaining < RATE_LIMIT_CRITICAL_THRESHOLD) {
        post({ type: "RATE_LIMIT_CRITICAL" });
        isPolling = false;
        return;
      }
      if (rateLimitRemaining < RATE_LIMIT_WARNING_THRESHOLD) {
        post({ type: "RATE_LIMIT_WARNING" });
      }

      continue; // Move to next batch
    }

    // Sequential processing for batches 2+
    for (const repoStr of batch) {
      if (signal.aborted) break outer;

      // Hard stop if rate limit is critically low
      if (rateLimitRemaining < RATE_LIMIT_CRITICAL_THRESHOLD) {
        post({ type: "RATE_LIMIT_CRITICAL" });
        isPolling = false;
        return;
      }

      const parsed = parseRepo(repoStr);
      if (!parsed) continue;

      const { owner, repo } = parsed;

      let result: FetchRepoDataResult;
      try {
        result = await fetchRepoData(owner, repo, pat || undefined, signal);
      } catch (err) {
        // network_error — skip this repo, do not crash the poll loop
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("network_error")) {
          // Post a synthetic result so the hook knows this repo failed
          post({
            type: "REPO_UPDATE",
            repo: repoStr,
            data: {
              repoInfo: null,
              deltaCommits: [],
              recentCommits: [],
              fullCommits: null,
              contributorCount: null,
              contributors: null,
              rateLimit: lastRateLimitState,
              tier: 1,
              error: "not_found",
            },
          });
          continue;
        }
        // Unknown error — skip silently if aborted
        if (signal.aborted) break outer;
        continue;
      }

      if (signal.aborted) break outer;

      // Update our local rate limit tracking
      rateLimitRemaining = result.rateLimit.remaining;
      lastRateLimitState = result.rateLimit;

      // Emit per-repo update
      post({ type: "REPO_UPDATE", repo: repoStr, data: result });

      // Check thresholds after each repo
      if (rateLimitRemaining < RATE_LIMIT_CRITICAL_THRESHOLD) {
        post({ type: "RATE_LIMIT_CRITICAL" });
        isPolling = false;
        return;
      }

      if (rateLimitRemaining < RATE_LIMIT_WARNING_THRESHOLD) {
        post({ type: "RATE_LIMIT_WARNING" });
      }
    }
  }

  if (!signal.aborted) {
    post({
      type: "POLL_COMPLETE",
      timestamp: new Date().toISOString(),
      rateLimitState: lastRateLimitState,
    });
  }

  isPolling = false;
}

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

(self as unknown as Worker).addEventListener(
  "message",
  (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data;

    if (msg.type === "STOP") {
      // Cancel any in-flight poll immediately
      currentController?.abort();
      currentController = null;
      isPolling = false;
      return;
    }

    if (msg.type === "START") {
      // If already polling, abort previous run before starting new one
      if (currentController) {
        currentController.abort();
      }

      currentController = new AbortController();
      const { repos, pat, rateLimitRemaining } = msg;

      // Fire-and-forget; errors inside runPoll are handled gracefully
      runPoll(repos, pat, rateLimitRemaining, currentController.signal).catch(
        () => {
          isPolling = false;
        }
      );
    }
  }
);
