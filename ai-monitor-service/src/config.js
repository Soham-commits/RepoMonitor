import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import Papa from "papaparse";
import * as XLSX from "xlsx";

dotenv.config();

const DEFAULT_CRON_SCHEDULE = "*/15 * * * *";
const DEFAULT_CRON_TIMEZONE = "UTC";
const DEFAULT_RECENT_COMMITS_LIMIT = 50;
const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const normalizeHeader = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");

const findHeaderKey = (headers, aliases) => {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeader(alias)));
  return headers.find((header) => aliasSet.has(normalizeHeader(header)));
};

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveFromServiceRoot(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(SERVICE_ROOT, filePath);
}

function parseRepoKey(input) {
  const trimmed = String(input ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "");

  if (!trimmed) {
    return null;
  }

  const parsePath = (pathValue) => {
    const parts = pathValue.split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return `${parts[0]}/${parts[1]}`;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.toLowerCase().includes("github.com")) {
        return null;
      }
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

function parseTeamsFromRows(rows) {
  if (!rows.length) {
    return { teams: [], hasRequiredColumns: false };
  }

  const headers = Object.keys(rows[0]);
  const teamIdKey = findHeaderKey(headers, ["Team ID", "team_id", "teamid"]);
  const teamNameKey = findHeaderKey(headers, ["Team Name", "team_name", "teamname"]);
  const psIdKey = findHeaderKey(headers, ["PS ID", "ps_id", "psid"]);
  const repoLinkKey = findHeaderKey(headers, [
    "GitHub Repo Link",
    "github_repo",
    "repo",
    "repo_link",
  ]);

  if (!teamIdKey || !teamNameKey || !psIdKey || !repoLinkKey) {
    return { teams: [], hasRequiredColumns: false };
  }

  const teams = rows
    .map((row) => {
      const teamId = String(row[teamIdKey] ?? "").trim();
      const teamName = String(row[teamNameKey] ?? "").trim();
      const psId = String(row[psIdKey] ?? "").trim();
      const repoLink = String(row[repoLinkKey] ?? "").trim();
      const repoKey = parseRepoKey(repoLink);

      if (!teamId || !teamName || !psId || !repoLink || !repoKey) {
        return null;
      }

      const [owner, repo] = repoKey.split("/");

      return {
        teamId,
        teamName,
        psId,
        repoLink,
        owner,
        repo,
      };
    })
    .filter((team) => Boolean(team));

  return { teams, hasRequiredColumns: true };
}

function extractReposFromValue(value, collector) {
  if (value === null || value === undefined) {
    return;
  }

  const text = String(value).trim();

  if (!text) {
    return;
  }

  const tokens = text
    .split(/[\s,;]+/)
    .map((token) => token.replace(/[()\[\]{}<>"'`]+/g, "").trim())
    .filter(Boolean);

  for (const token of tokens) {
    const repoKey = parseRepoKey(token);

    if (repoKey) {
      collector.add(repoKey);
      continue;
    }

    if (token.includes("//") || token.includes("www") || token.includes(".com") || token.includes("http")) {
      continue;
    }
  }
}

function parseRowsFromCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return (Array.isArray(parsed.data) ? parsed.data : []).filter((row) =>
    Object.values(row ?? {}).some((value) => String(value ?? "").trim() !== ""),
  );
}

function parseRowsFromXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.filter((row) =>
    Object.values(row ?? {}).some((value) => String(value ?? "").trim() !== ""),
  );
}

function parseTeamsFromImportRows(rows, importSource) {
  const parsedTeams = parseTeamsFromRows(rows);

  if (parsedTeams.hasRequiredColumns) {
    if (parsedTeams.teams.length === 0) {
      throw new Error(
        `No valid team rows found in Team ID, Team Name, PS ID, GitHub Repo Link columns for ${importSource}.`,
      );
    }

    return parsedTeams.teams;
  }

  const foundRepos = new Set();

  for (const row of rows) {
    for (const cellValue of Object.values(row)) {
      extractReposFromValue(cellValue, foundRepos);
    }
  }

  if (foundRepos.size === 0) {
    throw new Error(
      `No GitHub URLs detected in ${importSource}. Expected Team ID/Team Name/PS ID/GitHub Repo Link columns or any parseable GitHub repo links.`,
    );
  }

  return Array.from(foundRepos).map((repoKey, index) => {
    const [owner, repo] = repoKey.split("/");

    return {
      teamId: `TEAM-${index + 1}`,
      teamName: repoKey,
      psId: "Ungrouped",
      repoLink: `https://github.com/${repoKey}`,
      owner,
      repo,
    };
  });
}

function normalizeTeam(rawTeam, index) {
  const ownerFromFields = String(rawTeam?.owner ?? "").trim();
  const repoFromFields = String(rawTeam?.repo ?? "").trim();
  const parsedRepoKey = parseRepoKey(rawTeam?.repoKey);
  const parsedRepoLink = parseRepoKey(rawTeam?.repoLink);

  const resolvedRepoKey =
    ownerFromFields && repoFromFields
      ? `${ownerFromFields}/${repoFromFields}`
      : parsedRepoKey || parsedRepoLink;

  if (!resolvedRepoKey) {
    throw new Error(
      `Invalid team at index ${index}: owner/repo or a valid repoLink/repoKey is required.`,
    );
  }

  const [owner, repo] = resolvedRepoKey.split("/");

  const fallbackId = `${owner}/${repo}`;
  const teamId = String(rawTeam.teamId ?? rawTeam.id ?? fallbackId).trim();
  const teamName = String(rawTeam.teamName ?? rawTeam.name ?? teamId).trim();
  const psId = String(rawTeam.psId ?? rawTeam.problemStatementId ?? "Ungrouped").trim();
  const repoLink = String(rawTeam.repoLink ?? `https://github.com/${owner}/${repo}`).trim();
  const branch = rawTeam.branch ? String(rawTeam.branch).trim() : undefined;

  return {
    teamId,
    teamName,
    psId,
    repoLink,
    owner,
    repo,
    branch,
  };
}

function parseTeamsFromJsonString(jsonText) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Failed to parse HACKATHON_TEAMS_JSON: ${error.message}`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed?.teams)) {
    return parsed.teams;
  }

  throw new Error("HACKATHON_TEAMS_JSON must be a JSON array or { teams: [] }.");
}

function parseTeamsFromFile(filePath) {
  const resolvedPath = resolveFromServiceRoot(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`HACKATHON_TEAMS_FILE_PATH does not exist: ${resolvedPath}`);
  }

  const fileContent = fs.readFileSync(resolvedPath, "utf8");
  return parseTeamsFromJsonString(fileContent);
}

function parseTeamsFromImportFile(filePath) {
  const resolvedPath = resolveFromServiceRoot(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`HACKATHON_TEAMS_IMPORT_FILE_PATH does not exist: ${resolvedPath}`);
  }

  const extension = path.extname(resolvedPath).toLowerCase();

  if (extension === ".csv") {
    const csvText = fs.readFileSync(resolvedPath, "utf8");
    const rows = parseRowsFromCsv(csvText);
    return parseTeamsFromImportRows(rows, resolvedPath);
  }

  if (extension === ".xlsx") {
    const fileBuffer = fs.readFileSync(resolvedPath);
    const rows = parseRowsFromXlsx(fileBuffer);
    return parseTeamsFromImportRows(rows, resolvedPath);
  }

  if (extension === ".json") {
    return parseTeamsFromFile(resolvedPath);
  }

  throw new Error(
    `Unsupported team import file format: ${resolvedPath}. Use .csv, .xlsx, or .json.`,
  );
}

function loadTeams() {
  const teamsImportPath = process.env.HACKATHON_TEAMS_IMPORT_FILE_PATH?.trim();
  const teamsJson = process.env.HACKATHON_TEAMS_JSON?.trim();
  const teamsFilePath = process.env.HACKATHON_TEAMS_FILE_PATH?.trim();

  const providedSources = [teamsImportPath, teamsJson, teamsFilePath].filter(Boolean);

  if (providedSources.length > 1) {
    throw new Error(
      "Use only one of HACKATHON_TEAMS_IMPORT_FILE_PATH, HACKATHON_TEAMS_JSON, or HACKATHON_TEAMS_FILE_PATH.",
    );
  }

  if (providedSources.length === 0) {
    return [];
  }

  let teamRows;

  if (teamsImportPath) {
    teamRows = parseTeamsFromImportFile(teamsImportPath);
  } else if (teamsJson) {
    teamRows = parseTeamsFromJsonString(teamsJson);
  } else {
    const extension = path.extname(resolveFromServiceRoot(teamsFilePath)).toLowerCase();
    teamRows =
      extension === ".csv" || extension === ".xlsx"
        ? parseTeamsFromImportFile(teamsFilePath)
        : parseTeamsFromFile(teamsFilePath);
  }

  const normalized = teamRows.map((team, index) => normalizeTeam(team, index));
  const dedupedByRepo = Array.from(
    new Map(normalized.map((team) => [`${team.owner}/${team.repo}`, team])).values(),
  );
  const uniqueIds = new Set();

  for (const team of dedupedByRepo) {
    if (uniqueIds.has(team.teamId)) {
      throw new Error(`Duplicate teamId found: ${team.teamId}`);
    }
    uniqueIds.add(team.teamId);
  }

  return dedupedByRepo;
}

function parseRecipients(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const teams = loadTeams();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInteger(process.env.PORT, 8080),
  adminSecret: process.env.ADMIN_SECRET,
  cronSchedule: process.env.CRON_SCHEDULE?.trim() || DEFAULT_CRON_SCHEDULE,
  cronTimezone: process.env.CRON_TIMEZONE?.trim() || DEFAULT_CRON_TIMEZONE,
  autoStartMonitor: parseBoolean(process.env.AUTO_START_MONITOR, false),
  recentCommitsLimit: parseInteger(
    process.env.RECENT_COMMITS_LIMIT,
    DEFAULT_RECENT_COMMITS_LIMIT,
  ),
  githubToken: process.env.GITHUB_PAT?.trim() || process.env.GITHUB_TOKEN?.trim(),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: (process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash").toLowerCase(),
  teams,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
    recipients: parseRecipients(process.env.TWILIO_WHATSAPP_TO),
  },
};

const missingRequired = [];

if (!config.adminSecret) {
  missingRequired.push("ADMIN_SECRET");
}

if (!config.githubToken) {
  missingRequired.push("GITHUB_PAT (or GITHUB_TOKEN)");
}

if (!config.geminiApiKey) {
  missingRequired.push("GEMINI_API_KEY");
}

if (missingRequired.length > 0) {
  throw new Error(`Missing required environment variables: ${missingRequired.join(", ")}`);
}

if (config.teams.length === 0) {
  console.warn(
    "[ai-monitor-service] No teams configured. Set HACKATHON_TEAMS_IMPORT_FILE_PATH (preferred) or HACKATHON_TEAMS_JSON/HACKATHON_TEAMS_FILE_PATH.",
  );
}

export function getPublicConfig() {
  return {
    cronSchedule: config.cronSchedule,
    cronTimezone: config.cronTimezone,
    autoStartMonitor: config.autoStartMonitor,
    recentCommitsLimit: config.recentCommitsLimit,
    geminiModel: config.geminiModel,
    teams: config.teams.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      psId: team.psId,
      owner: team.owner,
      repo: team.repo,
    })),
    twilioEnabled:
      Boolean(config.twilio.accountSid) &&
      Boolean(config.twilio.authToken) &&
      Boolean(config.twilio.whatsappFrom) &&
      config.twilio.recipients.length > 0,
  };
}