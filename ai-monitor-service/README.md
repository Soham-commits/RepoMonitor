# ai-monitor-service

A standalone Node.js microservice that monitors hackathon team repositories, sends a full snapshot batch to Gemini for AI-based fraud detection, and pushes CRITICAL/HIGH alerts on WhatsApp through Twilio.

This service is fully decoupled from the existing Next.js frontend. If this service is down, the frontend remains unaffected.

## Stack

- Express.js
- Gemini 1.5 Flash via `@google/generative-ai`
- Octokit GitHub API client
- Twilio WhatsApp API
- `node-cron`

## Features

- Cron-based monitoring (default every 15 minutes)
- Batch snapshot collection across all configured teams
- Single Gemini prompt for all team snapshots
- Structured severity output (`CRITICAL`, `HIGH`, `MEDIUM`, `CLEAN`)
- WhatsApp alerts for `CRITICAL` and `HIGH`
- Manual control API:
  - `POST /api/monitor/start`
  - `POST /api/monitor/stop`
  - `POST /api/monitor/trigger`
  - `GET /api/monitor/status`
- Header-based endpoint protection (`x-admin-secret`)

## Setup

Requires Node.js 20+.

1. Install dependencies:

```bash
cd ai-monitor-service
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Update `.env` with real values:

- `ADMIN_SECRET`
- `GITHUB_PAT` (or `GITHUB_TOKEN`)
- `GEMINI_API_KEY`
- `HACKATHON_TEAMS_IMPORT_FILE_PATH` (recommended)
- Twilio settings (`TWILIO_*`) for WhatsApp alerts

4. Run locally:

```bash
npm run dev
```

## Team Configuration

Use your import file directly (same idea as frontend import).

Recommended source:

```env
HACKATHON_TEAMS_IMPORT_FILE_PATH=./ignisia_final_dataset.xlsx
```

Supported import formats: `.csv`, `.xlsx`, `.json`.

For `.csv` / `.xlsx` with structured team rows, expected columns are case-insensitive and spacing-insensitive:

- `Team ID`
- `Team Name`
- `PS ID`
- `GitHub Repo Link`

If those columns are missing, the service falls back to scanning all cells for parseable GitHub repo links.

Legacy sources are still supported (use only one source at a time).

### Inline

```env
HACKATHON_TEAMS_JSON=[{"teamId":"alpha","teamName":"Team Alpha","owner":"org","repo":"repo-one"},{"teamId":"beta","teamName":"Team Beta","owner":"org","repo":"repo-two"}]
```

### File

```env
HACKATHON_TEAMS_FILE_PATH=./teams.sample.json
```

## API Usage

All monitor endpoints require header:

```http
x-admin-secret: <ADMIN_SECRET>
```

### Start cron loop

```bash
curl -X POST http://localhost:8080/api/monitor/start \
  -H "x-admin-secret: $ADMIN_SECRET"
```

### Stop cron loop

```bash
curl -X POST http://localhost:8080/api/monitor/stop \
  -H "x-admin-secret: $ADMIN_SECRET"
```

### Trigger one-shot run

```bash
curl -X POST http://localhost:8080/api/monitor/trigger \
  -H "x-admin-secret: $ADMIN_SECRET"
```

### Read service status + last run

```bash
curl http://localhost:8080/api/monitor/status \
  -H "x-admin-secret: $ADMIN_SECRET"
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | Service port |
| `ADMIN_SECRET` | Yes | - | Shared secret for monitor API |
| `CRON_SCHEDULE` | No | `*/15 * * * *` | Monitoring schedule |
| `CRON_TIMEZONE` | No | `UTC` | Cron timezone |
| `AUTO_START_MONITOR` | No | `false` | Auto-start cron on boot |
| `GITHUB_PAT` | Yes* | - | GitHub PAT for repo reads (preferred) |
| `GITHUB_TOKEN` | Yes* | - | Backward-compatible alias for PAT |
| `GEMINI_API_KEY` | Yes | - | Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model name |
| `RECENT_COMMITS_LIMIT` | No | `50` | Number of recent commits pulled per repo |
| `HACKATHON_TEAMS_IMPORT_FILE_PATH` | Cond. | - | Path to import file (`.csv`/`.xlsx`/`.json`) |
| `HACKATHON_TEAMS_JSON` | Cond. | - | Inline JSON array of team repo specs |
| `HACKATHON_TEAMS_FILE_PATH` | Cond. | - | Legacy file path (`.json`/`.csv`/`.xlsx`) |
| `TWILIO_ACCOUNT_SID` | Alerting | - | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Alerting | - | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Alerting | - | Sender, e.g. `whatsapp:+14155238886` |
| `TWILIO_WHATSAPP_TO` | Alerting | - | Comma-separated recipient list |

`*` Set either `GITHUB_PAT` or `GITHUB_TOKEN`.

## Railway Deploy

1. Create a new service from this repository.
2. Set root directory to `ai-monitor-service`.
3. Set start command to `npm start`.
4. Add required environment variables.

## Render Deploy

1. Create a new Web Service from this repository.
2. Set root directory to `ai-monitor-service`.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Add required environment variables.

## Notes

- The AI analysis is centralized in one batch prompt per run as requested.
- If Twilio config is missing, monitoring still runs but alert sends are skipped and reflected in run results.
- `GET /health` can be used as a platform healthcheck endpoint.