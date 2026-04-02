import express from "express";
import { config } from "./config.js";
import { createMonitorRouter } from "./routes/monitorRoutes.js";
import { GeminiAnalysisService } from "./services/geminiAnalysisService.js";
import { GitHubSnapshotService } from "./services/githubSnapshotService.js";
import { MonitorOrchestrator } from "./services/monitorOrchestrator.js";
import { WhatsAppAlertService } from "./services/whatsappAlertService.js";

const githubSnapshotService = new GitHubSnapshotService({
  githubToken: config.githubToken,
  recentCommitsLimit: config.recentCommitsLimit,
});

const geminiAnalysisService = new GeminiAnalysisService({
  geminiApiKey: config.geminiApiKey,
  geminiModel: config.geminiModel,
});

const whatsappAlertService = new WhatsAppAlertService({
  accountSid: config.twilio.accountSid,
  authToken: config.twilio.authToken,
  whatsappFrom: config.twilio.whatsappFrom,
  recipients: config.twilio.recipients,
});

const orchestrator = new MonitorOrchestrator({
  config,
  githubSnapshotService,
  geminiAnalysisService,
  whatsappAlertService,
});

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (request, response) => {
  response.status(200).json({
    service: "ai-monitor-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use(
  "/api/monitor",
  createMonitorRouter({
    adminSecret: config.adminSecret,
    orchestrator,
  }),
);

app.use((error, request, response, next) => {
  console.error("[ai-monitor-service] Unhandled error:", error);
  response.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.port, () => {
  console.log(`[ai-monitor-service] Listening on port ${config.port}`);

  if (config.autoStartMonitor) {
    const startResult = orchestrator.startCron();
    console.log("[ai-monitor-service] AUTO_START_MONITOR enabled:", startResult.message);
  }
});

function shutdown(signal) {
  console.log(`[ai-monitor-service] Received ${signal}. Shutting down...`);
  orchestrator.stopCron();

  server.close(() => {
    console.log("[ai-monitor-service] Shutdown complete.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));