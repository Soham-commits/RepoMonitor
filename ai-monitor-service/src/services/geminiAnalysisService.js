import { GoogleGenerativeAI } from "@google/generative-ai";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "CLEAN"];

function parseModelJson(rawText) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("Gemini returned an empty response.");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error("Gemini output did not contain valid JSON.");
    }

    const jsonSlice = candidate.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonSlice);
  }
}

function sanitizeSeverity(value, fallback = "MEDIUM") {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return SEVERITIES.includes(normalized) ? normalized : fallback;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function buildPrompt({ runId, cronSchedule, snapshotBatch }) {
  return [
    "You are an AI anti-cheating surveillance analyst for a hackathon.",
    "You will receive GitHub repository snapshots for all teams in ONE batch.",
    "Detect suspicious behavior and return strict JSON only.",
    "",
    "Your mandatory checks:",
    "1) Teams using an existing OSS repository instead of an original project (React, Angular, PyTorch, etc.)",
    "2) Dead or inactive repositories",
    "3) Single-contributor projects when team work is expected",
    "4) Pre-loaded code before active hackathon coding",
    "5) Suspicious commit velocity or burst patterns",
    "6) Potential plagiarism signals across teams or known public patterns",
    "",
    "Assign severity per team using EXACT labels:",
    "- CRITICAL",
    "- HIGH",
    "- MEDIUM",
    "- CLEAN",
    "",
    "Output schema (JSON only):",
    "{",
    '  "runSummary": {',
    '    "overallSummary": "string",',
    '    "criticalCount": 0,',
    '    "highCount": 0,',
    '    "mediumCount": 0,',
    '    "cleanCount": 0',
    "  },",
    '  "teams": [',
    "    {",
    '      "teamId": "string",',
    '      "teamName": "string",',
    '      "severity": "CRITICAL|HIGH|MEDIUM|CLEAN",',
    '      "summary": "short reason",',
    '      "reasons": ["reason 1", "reason 2"],',
    '      "evidence": ["specific evidence text"],',
    '      "recommendedAction": "what organizers should do next",',
    '      "confidence": 0.0',
    "    }",
    "  ]",
    "}",
    "",
    "Hard requirements:",
    "- Return valid JSON only, no markdown, no code fences.",
    "- Include every team exactly once.",
    "- Keep summaries concise and factual.",
    "- Use evidence strings grounded in the provided snapshot data.",
    "",
    `Run metadata: runId=${runId}, cronSchedule=${cronSchedule}`,
    "Snapshot payload:",
    JSON.stringify(snapshotBatch),
  ].join("\n");
}

function normalizeModelOutput(modelOutput, snapshotBatch) {
  const teamsFromModel = Array.isArray(modelOutput?.teams) ? modelOutput.teams : [];
  const modelIndex = new Map();

  for (const team of teamsFromModel) {
    const teamId = String(team.teamId ?? "").trim();

    if (teamId) {
      modelIndex.set(teamId, team);
    }
  }

  const normalizedTeams = snapshotBatch.snapshots.map((snapshot) => {
    const modelTeam = modelIndex.get(snapshot.teamId);

    if (!modelTeam) {
      return {
        teamId: snapshot.teamId,
        teamName: snapshot.teamName,
        severity: snapshot.status === "error" ? "HIGH" : "MEDIUM",
        summary:
          snapshot.status === "error"
            ? "Snapshot collection failed, requires manual review."
            : "Model did not return an entry for this team.",
        reasons:
          snapshot.status === "error"
            ? [snapshot.error?.message ?? "Unknown snapshot failure"]
            : ["Missing model output entry"],
        evidence: [],
        recommendedAction: "Manual verification",
        confidence: null,
      };
    }

    return {
      teamId: snapshot.teamId,
      teamName: snapshot.teamName,
      severity: sanitizeSeverity(modelTeam.severity, "MEDIUM"),
      summary: String(modelTeam.summary ?? "No summary provided"),
      reasons: normalizeArray(modelTeam.reasons),
      evidence: normalizeArray(modelTeam.evidence),
      recommendedAction: String(modelTeam.recommendedAction ?? "Manual verification"),
      confidence:
        typeof modelTeam.confidence === "number"
          ? Number(modelTeam.confidence)
          : null,
    };
  });

  const counts = {
    CRITICAL: normalizedTeams.filter((team) => team.severity === "CRITICAL").length,
    HIGH: normalizedTeams.filter((team) => team.severity === "HIGH").length,
    MEDIUM: normalizedTeams.filter((team) => team.severity === "MEDIUM").length,
    CLEAN: normalizedTeams.filter((team) => team.severity === "CLEAN").length,
  };

  return {
    runSummary: {
      overallSummary: String(modelOutput?.runSummary?.overallSummary ?? "No summary provided"),
      criticalCount: counts.CRITICAL,
      highCount: counts.HIGH,
      mediumCount: counts.MEDIUM,
      cleanCount: counts.CLEAN,
    },
    teams: normalizedTeams,
  };
}

export class GeminiAnalysisService {
  constructor({ geminiApiKey, geminiModel }) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    this.modelName = geminiModel;
    this.model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });
  }

  async analyze(snapshotBatch, runMetadata) {
    const prompt = buildPrompt({
      runId: runMetadata.runId,
      cronSchedule: runMetadata.cronSchedule,
      snapshotBatch,
    });

    const response = await this.model.generateContent(prompt);
    const rawText = response.response.text();
    const modelOutput = parseModelJson(rawText);
    const normalized = normalizeModelOutput(modelOutput, snapshotBatch);

    return {
      model: this.modelName,
      generatedAt: new Date().toISOString(),
      ...normalized,
    };
  }
}