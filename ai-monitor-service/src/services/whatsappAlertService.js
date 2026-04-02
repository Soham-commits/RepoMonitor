import twilio from "twilio";

function buildAlertMessage(team, runResult) {
  const reasons = team.reasons.length > 0 ? team.reasons.slice(0, 3).join(" | ") : team.summary;

  return [
    `[AI Monitor] ${team.severity} flag detected`,
    `Team: ${team.teamName} (${team.teamId})`,
    `Repo: ${team.owner}/${team.repo}`,
    `Summary: ${team.summary}`,
    `Reasons: ${reasons}`,
    `Recommended action: ${team.recommendedAction}`,
    `Run: ${runResult.runId}`,
  ].join("\n");
}

export class WhatsAppAlertService {
  constructor({ accountSid, authToken, whatsappFrom, recipients }) {
    this.recipients = recipients;
    this.enabled =
      Boolean(accountSid) &&
      Boolean(authToken) &&
      Boolean(whatsappFrom) &&
      Array.isArray(recipients) &&
      recipients.length > 0;

    this.disabledReason = null;

    if (this.enabled) {
      this.client = twilio(accountSid, authToken);
      this.whatsappFrom = whatsappFrom;
    } else {
      this.disabledReason =
        "Twilio is not fully configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, and TWILIO_WHATSAPP_TO.";
    }
  }

  async sendTeamAlerts(runResult) {
    const flaggedTeams = runResult.teams.filter(
      (team) => team.severity === "CRITICAL" || team.severity === "HIGH",
    );

    if (flaggedTeams.length === 0) {
      return {
        enabled: this.enabled,
        sentCount: 0,
        failedCount: 0,
        skippedReason: "No CRITICAL/HIGH teams in this run.",
      };
    }

    if (!this.enabled) {
      return {
        enabled: false,
        sentCount: 0,
        failedCount: 0,
        skippedReason: this.disabledReason,
        pendingAlerts: flaggedTeams.length,
      };
    }

    let sentCount = 0;
    const failures = [];

    for (const recipient of this.recipients) {
      for (const team of flaggedTeams) {
        try {
          await this.client.messages.create({
            from: this.whatsappFrom,
            to: recipient,
            body: buildAlertMessage(team, runResult),
          });

          sentCount += 1;
        } catch (error) {
          failures.push({
            recipient,
            teamId: team.teamId,
            message: error.message,
          });
        }
      }
    }

    return {
      enabled: true,
      sentCount,
      failedCount: failures.length,
      failures,
    };
  }
}