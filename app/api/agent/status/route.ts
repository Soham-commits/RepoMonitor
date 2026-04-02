import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unwrapQuotedValue(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function readServiceEnvValue(key: string): string | undefined {
  const envPath = path.resolve(process.cwd(), "ai-monitor-service/.env");

  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const fileContent = fs.readFileSync(envPath, "utf8");
  const lines = fileContent.split(/\r?\n/);
  const matching = lines.find((line) => line.trim().startsWith(`${key}=`));

  if (!matching) {
    return undefined;
  }

  return unwrapQuotedValue(matching.slice(key.length + 1));
}

function resolveMonitorBaseUrl(): string {
  const fromEnv = process.env.AI_MONITOR_BASE_URL?.trim();

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  const port =
    process.env.AI_MONITOR_PORT?.trim() ||
    readServiceEnvValue("PORT") ||
    "8080";

  return `http://localhost:${port}`;
}

function resolveMonitorSecret(): string | null {
  const secret =
    process.env.AI_MONITOR_ADMIN_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    readServiceEnvValue("ADMIN_SECRET") ||
    "";

  return secret || null;
}

function buildStateText(status: {
  connected: boolean;
  configured: boolean;
  cronRunning: boolean;
  isExecuting: boolean;
  lastErrorMessage: string | null;
}): string {
  if (!status.configured) {
    return "Agent secret not configured";
  }

  if (!status.connected) {
    return "Agent service unreachable";
  }

  if (status.isExecuting) {
    return "Analyzing repositories now";
  }

  if (status.cronRunning) {
    return "Active and waiting for next schedule";
  }

  if (status.lastErrorMessage) {
    return "Paused due to last run error";
  }

  return "Paused";
}

export async function GET() {
  const monitorBaseUrl = resolveMonitorBaseUrl();
  const monitorSecret = resolveMonitorSecret();

  if (!monitorSecret) {
    return NextResponse.json({
      connected: false,
      configured: false,
      cronRunning: false,
      isExecuting: false,
      runCounter: 0,
      currentActivity: buildStateText({
        connected: false,
        configured: false,
        cronRunning: false,
        isExecuting: false,
        lastErrorMessage: null,
      }),
      message:
        "Set AI_MONITOR_ADMIN_SECRET in Next env or ADMIN_SECRET in ai-monitor-service/.env.",
      lastErrorMessage: null,
      lastRunFinishedAt: null,
      lastRunSummary: null,
      lastAlertSentCount: 0,
      lastAlertFailedCount: 0,
    });
  }

  try {
    const response = await fetch(`${monitorBaseUrl}/api/monitor/status`, {
      method: "GET",
      headers: {
        "x-admin-secret": monitorSecret,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        connected: false,
        configured: true,
        cronRunning: false,
        isExecuting: false,
        runCounter: 0,
        currentActivity: buildStateText({
          connected: false,
          configured: true,
          cronRunning: false,
          isExecuting: false,
          lastErrorMessage: null,
        }),
        message: `Agent returned HTTP ${response.status}`,
        lastErrorMessage: null,
        lastRunFinishedAt: null,
        lastRunSummary: null,
        lastAlertSentCount: 0,
        lastAlertFailedCount: 0,
      });
    }

    const payload = await response.json();
    const lastRun = payload?.lastRun ?? null;
    const alertResult = lastRun?.alertResult ?? null;

    const result = {
      connected: true,
      configured: true,
      cronRunning: Boolean(payload?.cronRunning),
      isExecuting: Boolean(payload?.isExecuting),
      runCounter: Number(payload?.runCounter ?? 0),
      currentActivity: buildStateText({
        connected: true,
        configured: true,
        cronRunning: Boolean(payload?.cronRunning),
        isExecuting: Boolean(payload?.isExecuting),
        lastErrorMessage: payload?.lastError?.message ?? null,
      }),
      message: null,
      lastErrorMessage: payload?.lastError?.message ?? null,
      lastRunFinishedAt: payload?.lastRunFinishedAt ?? null,
      lastRunSummary: lastRun?.runSummary?.overallSummary ?? null,
      lastAlertSentCount: Number(alertResult?.sentCount ?? 0),
      lastAlertFailedCount: Number(alertResult?.failedCount ?? 0),
      lastTriggeredBy: lastRun?.triggeredBy ?? null,
      lastRunId: lastRun?.runId ?? null,
      severityCounts: lastRun?.severityCounts ?? null,
      lastSkippedReason: alertResult?.skippedReason ?? null,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      connected: false,
      configured: true,
      cronRunning: false,
      isExecuting: false,
      runCounter: 0,
      currentActivity: buildStateText({
        connected: false,
        configured: true,
        cronRunning: false,
        isExecuting: false,
        lastErrorMessage: null,
      }),
      message:
        error instanceof Error
          ? error.message
          : "Unexpected error while reading agent status.",
      lastErrorMessage: null,
      lastRunFinishedAt: null,
      lastRunSummary: null,
      lastAlertSentCount: 0,
      lastAlertFailedCount: 0,
    });
  }
}
