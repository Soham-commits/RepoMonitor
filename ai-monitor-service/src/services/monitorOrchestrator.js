import cron from "node-cron";

function countBySeverity(teams) {
  return {
    CRITICAL: teams.filter((team) => team.severity === "CRITICAL").length,
    HIGH: teams.filter((team) => team.severity === "HIGH").length,
    MEDIUM: teams.filter((team) => team.severity === "MEDIUM").length,
    CLEAN: teams.filter((team) => team.severity === "CLEAN").length,
  };
}

function compactSnapshot(snapshot) {
  if (snapshot.status === "error") {
    return {
      status: snapshot.status,
      snapshotAt: snapshot.snapshotAt,
      error: snapshot.error,
    };
  }

  return {
    status: snapshot.status,
    snapshotAt: snapshot.snapshotAt,
    repository: snapshot.repository,
    metrics: snapshot.metrics,
    topContributors: snapshot.contributors.slice(0, 5),
    latestCommits: snapshot.commits.slice(0, 10),
    languages: snapshot.languages,
    rootFiles: snapshot.rootFiles,
    collectionErrors: snapshot.collectionErrors,
  };
}

function mergeSnapshotAndAnalysis(snapshot, analysisTeam) {
  if (!analysisTeam) {
    return {
      teamId: snapshot.teamId,
      teamName: snapshot.teamName,
      owner: snapshot.owner,
      repo: snapshot.repo,
      severity: snapshot.status === "error" ? "HIGH" : "MEDIUM",
      summary:
        snapshot.status === "error"
          ? "Repository snapshot failed. Needs manual verification."
          : "No model output was produced for this team.",
      reasons:
        snapshot.status === "error"
          ? [snapshot.error?.message ?? "Unknown snapshot failure"]
          : ["Team missing from model output"],
      evidence: [],
      recommendedAction: "Manual verification",
      confidence: null,
      snapshot: compactSnapshot(snapshot),
    };
  }

  return {
    teamId: snapshot.teamId,
    teamName: snapshot.teamName,
    owner: snapshot.owner,
    repo: snapshot.repo,
    severity: analysisTeam.severity,
    summary: analysisTeam.summary,
    reasons: analysisTeam.reasons,
    evidence: analysisTeam.evidence,
    recommendedAction: analysisTeam.recommendedAction,
    confidence: analysisTeam.confidence,
    snapshot: compactSnapshot(snapshot),
  };
}

export class MonitorOrchestrator {
  constructor({ config, githubSnapshotService, geminiAnalysisService, whatsappAlertService }) {
    this.config = config;
    this.githubSnapshotService = githubSnapshotService;
    this.geminiAnalysisService = geminiAnalysisService;
    this.whatsappAlertService = whatsappAlertService;

    this.cronTask = null;
    this.isExecuting = false;
    this.lastRun = null;
    this.lastError = null;
    this.lastRunStartedAt = null;
    this.lastRunFinishedAt = null;
    this.runCounter = 0;
  }

  startCron() {
    if (this.cronTask) {
      return {
        started: false,
        message: "Cron loop is already running.",
        schedule: this.config.cronSchedule,
        timezone: this.config.cronTimezone,
      };
    }

    if (!cron.validate(this.config.cronSchedule)) {
      throw new Error(`Invalid CRON_SCHEDULE: ${this.config.cronSchedule}`);
    }

    this.cronTask = cron.schedule(
      this.config.cronSchedule,
      () => {
        void this.runOnce("cron").catch((error) => {
          console.error("[ai-monitor-service] Cron run failed:", error.message);
        });
      },
      {
        timezone: this.config.cronTimezone,
      },
    );

    return {
      started: true,
      message: "Cron loop started.",
      schedule: this.config.cronSchedule,
      timezone: this.config.cronTimezone,
    };
  }

  stopCron() {
    if (!this.cronTask) {
      return {
        stopped: false,
        message: "Cron loop is not running.",
      };
    }

    this.cronTask.stop();
    if (typeof this.cronTask.destroy === "function") {
      this.cronTask.destroy();
    }
    this.cronTask = null;

    return {
      stopped: true,
      message: "Cron loop stopped.",
    };
  }

  async triggerManual() {
    return this.runOnce("manual");
  }

  async runOnce(triggeredBy) {
    if (this.isExecuting) {
      const error = new Error("A monitoring run is already in progress.");
      error.code = "RUN_IN_PROGRESS";
      throw error;
    }

    if (this.config.teams.length === 0) {
      const error = new Error(
        "No teams configured. Set HACKATHON_TEAMS_IMPORT_FILE_PATH (preferred) or HACKATHON_TEAMS_JSON/HACKATHON_TEAMS_FILE_PATH.",
      );
      error.code = "NO_TEAMS_CONFIGURED";
      throw error;
    }

    this.isExecuting = true;
    this.lastError = null;

    const runId = `run_${Date.now()}`;
    const startedAt = new Date().toISOString();
    this.lastRunStartedAt = startedAt;

    try {
      const snapshotBatch = await this.githubSnapshotService.fetchSnapshots(this.config.teams);
      const analysis = await this.geminiAnalysisService.analyze(snapshotBatch, {
        runId,
        cronSchedule: this.config.cronSchedule,
      });

      const analysisIndex = new Map(analysis.teams.map((team) => [team.teamId, team]));
      const mergedTeams = snapshotBatch.snapshots.map((snapshot) =>
        mergeSnapshotAndAnalysis(snapshot, analysisIndex.get(snapshot.teamId)),
      );

      const severityCounts = countBySeverity(mergedTeams);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);

      const runResult = {
        runId,
        triggeredBy,
        startedAt,
        finishedAt,
        durationMs,
        model: analysis.model,
        runSummary: analysis.runSummary,
        severityCounts,
        totalTeams: mergedTeams.length,
        teams: mergedTeams,
      };

      const alertResult = await this.whatsappAlertService.sendTeamAlerts(runResult);
      runResult.alertResult = alertResult;

      this.lastRun = runResult;
      this.lastRunFinishedAt = finishedAt;
      this.runCounter += 1;

      return runResult;
    } catch (error) {
      this.lastError = {
        message: error.message,
        code: error.code ?? null,
        at: new Date().toISOString(),
      };

      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  getStatus() {
    return {
      cronRunning: Boolean(this.cronTask),
      cronSchedule: this.config.cronSchedule,
      cronTimezone: this.config.cronTimezone,
      isExecuting: this.isExecuting,
      runCounter: this.runCounter,
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunFinishedAt: this.lastRunFinishedAt,
      lastError: this.lastError,
      lastRun: this.lastRun,
    };
  }
}