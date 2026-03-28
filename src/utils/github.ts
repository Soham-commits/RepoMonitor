// src/utils/github.ts
// Pure GitHub API utility — no UI, no side effects beyond in-memory cache.

// ---------------------------------------------------------------------------
// UTC Constants (hardcoded — no runtime conversion)
// ---------------------------------------------------------------------------
export const HACKATHON_START = "2026-04-02T06:30:00Z";
export const HACKATHON_END = "2026-04-04T18:29:00Z";

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export interface RepoInfo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  visibility: "public" | "private" | "internal";
  default_branch: string;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
}

export interface CommitData {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: { login: string; avatar_url: string } | null;
  parents: Array<{ sha: string }>;
}

export interface ContributorData {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

export type TierLevel = 1 | 2;

export interface RateLimitState {
  remaining: number;
  reset: number; // Unix timestamp (seconds)
  limit: number;
}

export type FetchResult<T> =
  | { data: T; rateLimit: RateLimitState }
  | { error: "rate_limited"; retryAfter: number; rateLimit: RateLimitState }
  | { error: "not_found"; rateLimit: RateLimitState }
  | { error: "aborted" }
  | { commits: CommitData[]; status: "empty"; rateLimit: RateLimitState };

// ---------------------------------------------------------------------------
// Internal: ETag Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  etag: string;
  data: unknown;
}

// Key format: "owner/repo:endpoint"
const etagCache = new Map<string, CacheEntry>();

function cacheKey(owner: string, repo: string, endpoint: string): string {
  return `${owner}/${repo}:${endpoint}`;
}

// ---------------------------------------------------------------------------
// Internal: lastPollTime per repo
// ---------------------------------------------------------------------------

// Key format: "owner/repo"
const lastPollTime = new Map<string, string>();

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function getLastPollTime(owner: string, repo: string): string {
  return lastPollTime.get(repoKey(owner, repo)) ?? HACKATHON_START;
}

export function setLastPollTime(
  owner: string,
  repo: string,
  isoTime: string
): void {
  lastPollTime.set(repoKey(owner, repo), isoTime);
}

// ---------------------------------------------------------------------------
// Internal: Rate limit parsing
// ---------------------------------------------------------------------------

function parseRateLimit(headers: Headers): RateLimitState {
  return {
    remaining: parseInt(headers.get("X-RateLimit-Remaining") ?? "0", 10),
    reset: parseInt(headers.get("X-RateLimit-Reset") ?? "0", 10),
    limit: parseInt(headers.get("X-RateLimit-Limit") ?? "5000", 10),
  };
}

// ---------------------------------------------------------------------------
// Internal: Build request headers
// ---------------------------------------------------------------------------

function buildHeaders(pat: string | undefined, etag?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (pat) {
    headers["Authorization"] = `token ${pat}`;
  }

  if (etag) {
    headers["If-None-Match"] = etag;
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Internal: Retry-aware fetch with backoff
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [1000, 3000, 5000];

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) {
      // Throw a specific DOMException so callers can detect abort
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const response = await fetch(url, { ...options, signal });

      // Do not retry 4xx (client errors)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Success or non-retryable error
      if (response.ok || response.status === 304) {
        return response;
      }

      // 5xx — retry if attempts remain
      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      return response;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err; // Propagate abort immediately
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw new Error("network_error: " + (lastError?.message ?? "unknown"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Internal: Generic cached GET
// ---------------------------------------------------------------------------

async function cachedGet<T>(
  owner: string,
  repo: string,
  endpoint: string,
  url: string,
  pat: string | undefined,
  signal?: AbortSignal
): Promise<
  | { status: "ok"; data: T; rateLimit: RateLimitState }
  | { status: "not_modified"; data: T; rateLimit: RateLimitState }
  | { status: 403; rateLimit: RateLimitState; retryAfter: number }
  | { status: 404; rateLimit: RateLimitState }
  | { status: "aborted" }
  | { status: "network_error" }
> {
  const key = cacheKey(owner, repo, endpoint);
  const cached = etagCache.get(key);
  const headers = buildHeaders(pat, cached?.etag);

  let response: Response;
  try {
    response = await fetchWithRetry(url, { method: "GET", headers }, signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { status: "aborted" };
    }
    // network_error or max retries exceeded
    throw new Error("network_error");
  }

  const rateLimit = parseRateLimit(response.headers);

  if (response.status === 304 && cached) {
    return { status: "not_modified", data: cached.data as T, rateLimit };
  }

  if (response.status === 403) {
    const retryAfter = rateLimit.reset;
    return { status: 403, rateLimit, retryAfter };
  }

  if (response.status === 404) {
    return { status: 404, rateLimit };
  }

  if (!response.ok) {
    // 5xx exhausted or unexpected — treat as network error
    throw new Error("network_error");
  }

  const data: T = await response.json();
  const newEtag = response.headers.get("ETag");

  if (newEtag) {
    etagCache.set(key, { etag: newEtag, data });
  }

  return { status: "ok", data, rateLimit };
}

// ---------------------------------------------------------------------------
// Internal: Paginated GET (for full hackathon commits)
// ---------------------------------------------------------------------------

async function paginatedGet<T extends unknown[]>(
  owner: string,
  repo: string,
  baseUrl: string,
  pat: string | undefined,
  signal?: AbortSignal,
  rateLimitStopThreshold = 1000
): Promise<
  | { data: T; rateLimit: RateLimitState; stopped: boolean }
  | { status: "aborted" }
  | { status: 403; rateLimit: RateLimitState; retryAfter: number }
  | { status: 404; rateLimit: RateLimitState }
> {
  const allItems: unknown[] = [];
  let page = 1;
  let lastRateLimit: RateLimitState = { remaining: 5000, reset: 0, limit: 5000 };
  let stopped = false;

  while (true) {
    const pageUrl = `${baseUrl}&page=${page}`;
    const endpoint = `paginated:${baseUrl}:p${page}`;

    const result = await cachedGet<T>(
      owner,
      repo,
      endpoint,
      pageUrl,
      pat,
      signal
    );

    if (result.status === "aborted") return { status: "aborted" };
    if (result.status === 403) return result;
    if (result.status === 404) return result;
    if (result.status === "network_error") return { status: 404, rateLimit: lastRateLimit };

    const successPage = result as { data: T; rateLimit: RateLimitState };
    lastRateLimit = successPage.rateLimit;
    const pageData = successPage.data as unknown[];

    allItems.push(...pageData);

    // Stop mid-repo if rate limit drops below threshold
    if (lastRateLimit.remaining < rateLimitStopThreshold) {
      stopped = true;
      break;
    }

    // No more pages
    if (pageData.length === 0) break;

    page++;
  }

  return { data: allItems as T, rateLimit: lastRateLimit, stopped };
}

// ---------------------------------------------------------------------------
// Exported: fetchRepoData
// Main orchestrator — runs Tier 1 always, Tier 2 conditionally.
// ---------------------------------------------------------------------------

export interface FetchRepoDataResult {
  repoInfo: RepoInfo | null;
  deltaCommits: CommitData[];         // Tier 1 — commits since lastPollTime
  recentCommits: CommitData[];        // Tier 1 — last 30 commits total (newly added)
  fullCommits: CommitData[] | null;   // Tier 2 only
  contributorCount: number | null;    // Tier 2 only
  contributors: ContributorData[] | null; // Tier 2 only
  rateLimit: RateLimitState;
  tier: TierLevel;
  error?: "rate_limited" | "not_found" | "aborted";
  retryAfter?: number;
  stoppedEarly?: boolean;             // Tier 2 stopped due to low rate limit
}

export async function fetchRepoData(
  owner: string,
  repo: string,
  pat?: string,
  signal?: AbortSignal
): Promise<FetchRepoDataResult> {
  const now = new Date().toISOString();
  const since = getLastPollTime(owner, repo);
  const until = HACKATHON_END;

  // Default fallback rate limit
  let rateLimit: RateLimitState = { remaining: 5000, reset: 0, limit: 5000 };

  // -------------------------------------------------------------------------
  // Tier 1: Repo info
  // -------------------------------------------------------------------------
  const repoInfoResult = await cachedGet<RepoInfo>(
    owner,
    repo,
    "repo_info",
    `https://api.github.com/repos/${owner}/${repo}`,
    pat,
    signal
  );

  if (repoInfoResult.status === "aborted" || repoInfoResult.status === "network_error") {
    return {
      repoInfo: null,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit,
      tier: 1,
      error: repoInfoResult.status === "aborted" ? "aborted" : undefined,
    };
  }

  if (repoInfoResult.status === 404) {
    return {
      repoInfo: null,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit: repoInfoResult.rateLimit,
      tier: 1,
      error: "not_found",
    };
  }

  if (repoInfoResult.status === 403) {
    return {
      repoInfo: null,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit: repoInfoResult.rateLimit,
      tier: 1,
      error: "rate_limited",
      retryAfter: repoInfoResult.retryAfter,
    };
  }

  const repoInfoSuccess = repoInfoResult as { data: RepoInfo; rateLimit: RateLimitState };
  rateLimit = repoInfoSuccess.rateLimit;
  const repoInfo = repoInfoSuccess.data;

  // -------------------------------------------------------------------------
  // Tier 1: Delta commits (since lastPollTime, exclude merges + bots)
  // -------------------------------------------------------------------------
  const deltaUrl =
    `https://api.github.com/repos/${owner}/${repo}/commits` +
    `?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=100`;

  const deltaResult = await cachedGet<CommitData[]>(
    owner,
    repo,
    `commits:delta:${since}`,
    deltaUrl,
    pat,
    signal
  );

  if (deltaResult.status === "aborted" || deltaResult.status === "network_error") {
    return {
      repoInfo,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit,
      tier: 1,
      error: deltaResult.status === "aborted" ? "aborted" : undefined,
    };
  }

  if (deltaResult.status === 403) {
    return {
      repoInfo,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit: deltaResult.rateLimit,
      tier: 1,
      error: "rate_limited",
      retryAfter: deltaResult.retryAfter,
    };
  }

  if (deltaResult.status === 404) {
    return {
      repoInfo,
      deltaCommits: [],
      recentCommits: [],
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit: deltaResult.rateLimit,
      tier: 1,
      error: "not_found",
    };
  }

  const deltaSuccess = deltaResult as { data: CommitData[]; rateLimit: RateLimitState };
  rateLimit = deltaSuccess.rateLimit;

  // Filter: exclude merge commits (>1 parent) + bot authors (login ends in [bot])
  const rawDelta = deltaSuccess.data ?? [];
  const deltaCommits = filterCommits(rawDelta);

  // --- Tier 1b: Contributors (Now Tier 1 to avoid "?" in UI) ---
  const contributorsResult = await cachedGet<ContributorData[]>(
    owner,
    repo,
    "contributors",
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`,
    pat,
    signal
  );

  let contributors: ContributorData[] | null = null;
  let contributorCount: number | null = null;

  if (
    contributorsResult.status === "ok" ||
    contributorsResult.status === "not_modified"
  ) {
    const successContrib = contributorsResult as { data: ContributorData[]; rateLimit: RateLimitState };
    rateLimit = successContrib.rateLimit;
    contributors = successContrib.data;
    contributorCount = contributors.length;
  }

  // --- Tier 1c: Recent commits (last 30 total) ---
  const recentResult = await cachedGet<CommitData[]>(
    owner,
    repo,
    "commits:recent",
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`,
    pat,
    signal
  );

  const recentCommits = (recentResult.status === "ok" || recentResult.status === "not_modified")
    ? filterCommits((recentResult as { data: CommitData[] }).data ?? [])
    : [];

  // Update lastPollTime to now so next call fetches only new commits
  setLastPollTime(owner, repo, now);

  // -------------------------------------------------------------------------
  // Tier 2 — conditional on remaining > 2000
  // -------------------------------------------------------------------------
  if (rateLimit.remaining <= 2000) {
    return {
      repoInfo,
      deltaCommits,
      recentCommits,
      fullCommits: null,
      contributorCount: null,
      contributors: null,
      rateLimit,
      tier: 1,
    };
  }

  // --- Tier 2a: (Placeholder for previous tier split) ---
  // (Assignment moved to Tier 1)

  if (contributorsResult.status === "aborted") {
    return {
      repoInfo,
      deltaCommits,
      recentCommits,
      fullCommits: null,
      contributorCount,
      contributors,
      rateLimit,
      tier: 1,
      error: "aborted",
    };
  }

  // (Assignment moved to Tier 1)

  // Stop Tier 2 early if rate limit too low
  if (rateLimit.remaining < 1000) {
    return {
      repoInfo,
      deltaCommits,
      recentCommits,
      fullCommits: null,
      contributorCount,
      contributors,
      rateLimit,
      tier: 2,
      stoppedEarly: true,
    };
  }

  // --- Tier 2b: Full hackathon window commits (paginated) ---
  const fullCommitsBaseUrl =
    `https://api.github.com/repos/${owner}/${repo}/commits` +
    `?since=${encodeURIComponent(HACKATHON_START)}&until=${encodeURIComponent(HACKATHON_END)}&per_page=100`;

  const fullResult = await paginatedGet<CommitData[]>(
    owner,
    repo,
    fullCommitsBaseUrl,
    pat,
    signal,
    1000 // stop threshold
  );

  if ("status" in fullResult) {
    if (fullResult.status === "aborted") {
      return {
        repoInfo,
        deltaCommits,
        recentCommits,
        fullCommits: null,
        contributorCount,
        contributors,
        rateLimit,
        tier: 2,
        error: "aborted",
      };
    }

    if (fullResult.status === 403) {
      return {
        repoInfo,
        deltaCommits,
        recentCommits,
        fullCommits: null,
        contributorCount,
        contributors,
        rateLimit: fullResult.rateLimit,
        tier: 2,
        error: "rate_limited",
        retryAfter: fullResult.retryAfter,
      };
    }

    if (fullResult.status === 404) {
      return {
        repoInfo,
        deltaCommits,
        recentCommits,
        fullCommits: null,
        contributorCount,
        contributors,
        rateLimit: fullResult.rateLimit,
        tier: 2,
        error: "not_found",
      };
    }
  }

  const successResult = fullResult as { data: CommitData[]; rateLimit: RateLimitState; stopped: boolean };
  rateLimit = successResult.rateLimit;
  const fullCommits = filterCommits(successResult.data);

  return {
    repoInfo,
    deltaCommits,
    recentCommits,
    fullCommits,
    contributorCount,
    contributors,
    rateLimit,
    tier: 2,
    stoppedEarly: successResult.stopped,
  };
}

// ---------------------------------------------------------------------------
// Exported: fetchRepoInfo — standalone Tier 1 repo info fetch
// ---------------------------------------------------------------------------

export async function fetchRepoInfo(
  owner: string,
  repo: string,
  pat?: string,
  signal?: AbortSignal
): Promise<FetchResult<RepoInfo>> {
  let result;
  try {
    result = await cachedGet<RepoInfo>(
      owner,
      repo,
      "repo_info",
      `https://api.github.com/repos/${owner}/${repo}`,
      pat,
      signal
    );
  } catch {
    throw new Error("network_error");
  }

  if ("status" in result) {
    if (result.status === "aborted") return { error: "aborted" };
    if (result.status === "network_error") return { error: "not_found", rateLimit: { remaining: 0, reset: 0, limit: 0 } };
    if (result.status === 403)
      return {
        error: "rate_limited",
        retryAfter: result.retryAfter,
        rateLimit: result.rateLimit,
      };
    if (result.status === 404) return { error: "not_found", rateLimit: result.rateLimit };
  }

  const successInfo = result as { data: RepoInfo; rateLimit: RateLimitState };
  return { data: successInfo.data, rateLimit: successInfo.rateLimit };
}

// ---------------------------------------------------------------------------
// Exported: fetchDeltaCommits — Tier 1 delta commits fetch
// ---------------------------------------------------------------------------

export async function fetchDeltaCommits(
  owner: string,
  repo: string,
  pat?: string,
  signal?: AbortSignal
): Promise<FetchResult<CommitData[]>> {
  const since = getLastPollTime(owner, repo);
  const until = HACKATHON_END;
  const now = new Date().toISOString();

  const url =
    `https://api.github.com/repos/${owner}/${repo}/commits` +
    `?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=100`;

  let result;
  try {
    result = await cachedGet<CommitData[]>(
      owner,
      repo,
      `commits:delta:${since}`,
      url,
      pat,
      signal
    );
  } catch {
    throw new Error("network_error");
  }

  if ("status" in result) {
    if (result.status === "aborted") return { error: "aborted" };
    if (result.status === "network_error") return { error: "not_found", rateLimit: { remaining: 0, reset: 0, limit: 0 } };
    if (result.status === 403)
      return {
        error: "rate_limited",
        retryAfter: result.retryAfter,
        rateLimit: result.rateLimit,
      };
    if (result.status === 404) return { error: "not_found", rateLimit: result.rateLimit };
  }

  const deltaSuccess2 = result as { data: CommitData[]; rateLimit: RateLimitState };
  const commits = filterCommits(deltaSuccess2.data ?? []);

  setLastPollTime(owner, repo, now);

  if (commits.length === 0) {
    return { commits: [], status: "empty", rateLimit: deltaSuccess2.rateLimit };
  }

  return { data: commits, rateLimit: deltaSuccess2.rateLimit };
}

// ---------------------------------------------------------------------------
// Exported: fetchContributors — Tier 2 contributors fetch
// ---------------------------------------------------------------------------

export async function fetchContributors(
  owner: string,
  repo: string,
  pat?: string,
  signal?: AbortSignal
): Promise<FetchResult<ContributorData[]>> {
  let result;
  try {
    result = await cachedGet<ContributorData[]>(
      owner,
      repo,
      "contributors",
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`,
      pat,
      signal
    );
  } catch {
    throw new Error("network_error");
  }

  if ("status" in result) {
    if (result.status === "aborted") return { error: "aborted" };
    if (result.status === "network_error") return { error: "not_found", rateLimit: { remaining: 0, reset: 0, limit: 0 } };
    if (result.status === 403)
      return {
        error: "rate_limited",
        retryAfter: result.retryAfter,
        rateLimit: result.rateLimit,
      };
    if (result.status === 404) return { error: "not_found", rateLimit: result.rateLimit };
  }

  const successContrib = result as { data: ContributorData[]; rateLimit: RateLimitState };
  return { data: successContrib.data, rateLimit: successContrib.rateLimit };
}

// ---------------------------------------------------------------------------
// Exported: fetchFullHackathonCommits — Tier 2 full window (paginated)
// ---------------------------------------------------------------------------

export async function fetchFullHackathonCommits(
  owner: string,
  repo: string,
  pat?: string,
  signal?: AbortSignal
): Promise<FetchResult<CommitData[]>> {
  const baseUrl =
    `https://api.github.com/repos/${owner}/${repo}/commits` +
    `?since=${encodeURIComponent(HACKATHON_START)}&until=${encodeURIComponent(HACKATHON_END)}&per_page=100`;

  let result;
  try {
    result = await paginatedGet<CommitData[]>(
      owner,
      repo,
      baseUrl,
      pat,
      signal,
      1000
    );
  } catch {
    throw new Error("network_error");
  }

  if ("status" in result) {
    if (result.status === "aborted") return { error: "aborted" };
    if (result.status === 403)
      return {
        error: "rate_limited",
        retryAfter: result.retryAfter,
        rateLimit: result.rateLimit,
      };
    if (result.status === 404) return { error: "not_found", rateLimit: result.rateLimit };
    return { error: "not_found", rateLimit: { remaining: 0, reset: 0, limit: 0 } }; // Network or unknown
  }

  const successResult = result as { data: CommitData[]; rateLimit: RateLimitState };
  const commits = filterCommits(successResult.data);

  if (commits.length === 0) {
    return { commits: [], status: "empty", rateLimit: successResult.rateLimit };
  }

  return { data: commits, rateLimit: successResult.rateLimit };
}

// ---------------------------------------------------------------------------
// Exported: getRateLimitState — check current rate limit
// ---------------------------------------------------------------------------

export async function getRateLimitState(
  pat?: string,
  signal?: AbortSignal
): Promise<RateLimitState | null> {
  try {
    const response = await fetchWithRetry(
      "https://api.github.com/rate_limit",
      { method: "GET", headers: buildHeaders(pat) },
      signal
    );
    return parseRateLimit(response.headers);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported: clearEtagCache — reset cache for a given repo or entirely
// ---------------------------------------------------------------------------

export function clearEtagCache(owner?: string, repo?: string): void {
  if (owner && repo) {
    const prefix = `${owner}/${repo}:`;
    for (const key of etagCache.keys()) {
      if (key.startsWith(prefix)) etagCache.delete(key);
    }
  } else {
    etagCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Exclude merge commits (parents.length > 1) and bot authors (login ends with [bot]).
 */
function filterCommits(commits: CommitData[]): CommitData[] {
  return commits.filter((c) => {
    if (c.parents && c.parents.length > 1) return false;
    if (c.author?.login?.endsWith("[bot]")) return false;
    return true;
  });
}
