import { Router } from "express";

function requireAdminSecret(adminSecret) {
  return (request, response, next) => {
    const suppliedSecret = request.header("x-admin-secret");

    if (!suppliedSecret || suppliedSecret !== adminSecret) {
      response.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid x-admin-secret header.",
      });
      return;
    }

    next();
  };
}

function mapRunErrorToStatus(error) {
  if (error.code === "RUN_IN_PROGRESS") {
    return 409;
  }

  if (error.code === "NO_TEAMS_CONFIGURED") {
    return 400;
  }

  return 500;
}

export function createMonitorRouter({ adminSecret, orchestrator }) {
  const router = Router();

  router.use(requireAdminSecret(adminSecret));

  router.post("/start", (request, response) => {
    const result = orchestrator.startCron();
    response.status(200).json(result);
  });

  router.post("/stop", (request, response) => {
    const result = orchestrator.stopCron();
    response.status(200).json(result);
  });

  router.post("/trigger", async (request, response) => {
    try {
      const result = await orchestrator.triggerManual();
      response.status(200).json(result);
    } catch (error) {
      response.status(mapRunErrorToStatus(error)).json({
        error: error.code ?? "MONITOR_RUN_FAILED",
        message: error.message,
      });
    }
  });

  router.get("/status", (request, response) => {
    response.status(200).json(orchestrator.getStatus());
  });

  return router;
}