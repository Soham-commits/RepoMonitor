# 🚀 Ignisia Repo Monitor

A lightweight, client-side dashboard to monitor ~100 GitHub repositories in real-time during **Ignisia 2026 — National AI Hackathon**.

---

## 🧠 Overview

Ignisia Repo Monitor provides a **single-pane view of all team repositories**, enabling organizers to track activity, validate submissions, and identify inactive or suspicious teams—without requiring any setup from participants.

- ⚡ No backend  
- 🌐 Runs entirely in browser  
- 🔑 Uses GitHub Personal Access Token (PAT)  
- 📊 Real-time monitoring with intelligent rate handling  

---

## 🛠 Tech Stack

- **Frontend:** React + Vite  
- **Styling:** Tailwind CSS  
- **Hosting:** Netlify  
- **API:** GitHub REST API v3  
- **Background Processing:** Web Worker  

---

## ⏱ Hackathon Window

All commit tracking is restricted to:

Start: 2026-04-02T06:30:00Z  
End:   2026-04-04T18:29:00Z  

---

## ⚙️ Features

### 📥 Input & Validation
- Bulk repo URL input  
- Supports `owner/repo` and full GitHub URLs  
- Validates repos before monitoring  

### 📊 Live Dashboard
- Repo name (clickable)  
- Last push time (relative)  
- Hackathon commit count  
- Recent activity (~30 commits)  
- Contributor count  
- Last commit message  

### 🟢 Status System
- **Active:** < 30 min  
- **Idle:** 30 min – 2 hrs  
- **Inactive:** > 2 hrs or no commits  
- **Error:** Invalid / private / failed fetch  

### 🚩 Flag System
- Zero hackathon commits  
- Solo contributor  
- Private repo  
- Invalid repo  

### 🔍 Controls
- Search by repo or owner  
- Filter by status  
- Sort by activity, commits, contributors  
- Manual override support  

### 📈 Stats Bar
- Total teams  
- Active / Idle / Inactive counts  

### 🔄 Auto Refresh
- Polling every 8 minutes  
- Countdown timer  
- Manual refresh option  

### 📤 Export
- CSV export for judges  
- Includes all metrics + flags  

---

## ⚡ Performance & Optimization

- **Delta Fetching:** Only new commits fetched (`since=last_poll - 60s`)  
- **ETag Caching:** Avoids unnecessary API calls  
- **Request Locking:** Prevents overlapping requests  
- **AbortController:** Cancels stale requests  
- **Batch Loading:** Initial fetch in staggered batches  

---

## 🧠 Rate Limit Strategy

GitHub limit: **5000 requests/hour**

| Mode | Behavior |
|------|--------|
| >2000 | Full data (Tier 1 + Tier 2) |
| 1000–2000 | Core data only (Tier 1) |
| <1000 | Degradation mode (active teams only) |
| <500 | Freeze system |

---

## 🧩 API Data Used

- Repo metadata (`pushed_at`, `created_at`, `private`)  
- Commit data (timestamp, message, author, SHA)  
- Contributors list  
- Rate limit headers  

---

## 🛡 Failure Handling

- Retries failed requests (2 attempts)  
- Preserves last valid data  
- Network loss → freezes UI with last updated timestamp  
- Invalid repos are flagged and skipped  

---

## 🚧 Build Order

1. API utilities  
2. Delta fetch + caching  
3. Polling system (Web Worker)  
4. Rate limiter  
5. Input + validation  
6. Dashboard UI  
7. Status + flags  
8. Export  
9. Deployment  
10. Load testing  

---

## ✅ Pre-Event Checklist

- Generate GitHub PAT (`public_repo` access)  
- Ensure all repos are public  
- Collect repo list  
- Test with 20–30 repos  
- Simulate:
  - rate limit drop  
  - invalid repos  
  - network failure  

---

## 🧠 Key Design Principles

- **Zero setup for participants**  
- **Maximum visibility for organizers**  
- **Rate-limit safe**  
- **Minimal, fast, reliable**  

---

## 📌 Final Note

This tool is purpose-built for hackathon operations—optimized for **speed, clarity, and resilience under pressure**.

---

**Ignisia 2026 — MIT-WPU**
