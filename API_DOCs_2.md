# Lumina Clippers — Discord Bot Integration Guide

> Reference doc for building the Discord bot that acts as a secondary frontend for the Lumina Clippers platform. Paste this file into your coding agent for full context.

---

## 1. Overview

The platform already has a web frontend at `portal.luminaclippers.com`. The Discord bot is a parallel client that lets clippers who live on Discord:

1. **Browse live and completed campaigns** (embed cards)
2. **Enter a campaign** from a card (button → modal → submit URL)
3. **Upload a proof/verification video**
4. **View their own stats and submission status**
5. **Get notified** when a submission is verified, rejected, or paid (optional — via bot sending DMs)

No Discord-specific tables needed — the backend already has a `/api/discord/*` router designed for this exact use case. Clippers are identified by **email** (the bot collects it once, stores it per Discord user).

---

## 2. Base URLs

| Environment | URL |
|---|---|
| Production | `https://lumina-clippers-api.onrender.com` |
| Local dev | `http://localhost:8000` |

Set `LUMINA_API_URL` as an env var in the bot.

---

## 3. Authentication Model

There are two kinds of requests:

### 3a. Public Discord endpoints — no auth
All endpoints under `/api/discord/*` are wide open (security is layered later). The bot passes `clipper_email` and optionally `discord_user_id` in the payload.

### 3b. Verification-video upload — uses `submission_token`
When you call `POST /api/discord/submit`, the backend creates the submission and returns its `submission_id`. To upload a proof video, you need the `submission_token` — fetch it from `GET /api/submission/{token}` (public) or just query the submission status and keep the token from the create response (see §4.3).

> **Local dev tip:** to get a token quickly, submit once and read the `submission_token` out of the `submissions` table, or fetch `GET /api/submission/{token}` by any known token.

---

## 4. Endpoints the Bot Needs

### 4.1 List open campaigns
`GET /api/discord/campaigns`

Use this to populate campaign cards in a channel.

**Response** (array)
```json
[
  {
    "id": 16,
    "name": "Adobe Clipping Campaign",
    "slug": "adobe-clipping",
    "description": "…",
    "thumbnail_url": "https://…",
    "accepted_platforms": "tiktok,instagram,youtube",
    "cpm_rate": 1.5,
    "max_payout": 500,
    "budget_total": 10000,
    "budget_used": 3421.45,
    "requirements_url": "https://…",
    "created_at": "2026-03-15T12:00:00"
  }
]
```

### 4.2 Get a single campaign
`GET /api/discord/campaigns/{campaign_id}`

Same shape as above plus `submission_count`. Use when someone clicks a "View details" button.

### 4.3 Submit a clip
`POST /api/discord/submit`

**Body**
```json
{
  "campaign_id": 16,
  "clipper_email": "user@example.com",
  "post_url": "https://www.tiktok.com/@user/video/7312…",
  "discord_user_id": "123456789012345678"
}
```

**Response**
```json
{
  "status": "ok",
  "submission_id": 4821,
  "submission_token": "7f2d8c1a-4e5b-…",
  "detail": "Submission recorded for tiktok — scraping stats in background"
}
```

Auto-creates a clipper account if the email is new. Deduplicates by URL globally. Detects the platform from the URL. Kicks off Apify scraping in the background.

**Save `submission_token`** — you need it to upload a verification video for this submission (see §4.6).

**Error cases** → `status: "error"` with a `detail` message (no `submission_token` returned). Common causes: campaign not open, platform not accepted, duplicate URL, unrecognized platform.

### 4.4 Get clipper stats
`GET /api/discord/clipper/{email}/stats`

For a `/me` or `/stats` slash command.

**Response**
```json
{
  "email": "user@example.com",
  "total_submissions": 12,
  "total_views": 1450300,
  "total_likes": 38200,
  "total_comments": 4100,
  "total_earnings": 217.50,
  "platforms": ["tiktok", "instagram"],
  "campaigns": [16, 22]
}
```

### 4.5 Get submission status
`GET /api/discord/submission/{submission_id}`

For follow-up "check status" commands. Returns views, likes, comments, earnings, status.

### 4.6 Upload verification video
`POST /api/submissions/{submission_id}/upload-verification?token={submission_token}`

**Request:** `multipart/form-data` with field `video` (mp4/quicktime/webm, max 100 MB).

**Auth:** query param `token` must match the submission's `submission_token`.

**Response**
```json
{ "status": "uploaded", "message": "Verification video uploaded successfully" }
```

**How to get the `submission_token`:** `POST /api/discord/submit` returns it in the response. Store it on the bot side against the `submission_id` (e.g. in your local SQLite) so you can re-use it later if the clipper comes back and says "I want to upload proof for submission #4821".

### 4.7 Check verification status
`GET /api/submissions/{submission_id}/verification-status?token={submission_token}`

**Response**
```json
{ "status": "pending | uploaded | verified | rejected", "note": "…", "has_video": true }
```

### 4.8 List all public campaigns (open + completed)
`GET /api/public/campaigns`

Use this for a `/campaigns` command that shows both live AND completed campaigns. The `/api/discord/campaigns` endpoint only returns open ones.

**Response** — same shape as Discord campaigns plus `status: "open" | "closed" | "completed"` and `client_name`.

---

## 5. Suggested Bot UX

### 5.1 Campaign posting
When an admin runs `/post-campaign <id>` in a channel, the bot:
1. Fetches `GET /api/discord/campaigns/{id}`
2. Builds an embed with thumbnail, description, CPM rate, max payout, budget usage
3. Adds two buttons:
   - **Enter Campaign** → opens a modal asking for URL + email
   - **View Requirements** → link-style button to `requirements_url`

### 5.2 Submission flow (button)
- User clicks **Enter Campaign**
- Bot opens a Discord modal with fields:
  - `Post URL` (required)
  - `Email` (required — bot can cache this per Discord user in SQLite to skip next time)
- On submit, bot calls `POST /api/discord/submit`
- On success, bot replies ephemerally with "✅ Submitted. Views will update shortly." and shows an **Upload Proof Video** button
- On error, bot replies ephemerally with the `detail` message

### 5.3 Verification video upload
- User clicks **Upload Proof Video** (or runs `/upload-proof <submission_id>`)
- Bot asks them to attach the video in the next message (or uploads directly from the button interaction)
- Bot streams the file to `POST /api/submissions/{id}/upload-verification?token=…` as `multipart/form-data`
- Confirms success ephemerally

### 5.4 Profile command
`/profile` or `/me` → calls `GET /api/discord/clipper/{email}/stats` → returns a stat embed.

### 5.5 Status check
`/status <submission_id>` → `GET /api/discord/submission/{id}` → embed.

### 5.6 Local email-to-Discord cache
Keep a tiny SQLite table in the bot: `discord_user_id → email` so the user only enters their email once. When they run any command, read email from cache.

---

## 6. Tech Stack Recommendation

| Piece | Choice | Why |
|---|---|---|
| Language | Node.js + TypeScript | Best Discord library ecosystem |
| Library | `discord.js` v14 | Slash commands, buttons, modals built in |
| HTTP | `undici` or `fetch` | Native, no deps |
| File upload | `form-data` | Needed for multipart |
| Local cache | `better-sqlite3` | Zero-config, synchronous, reliable |
| Hosting | Render (Worker service) | Matches rest of stack |

---

## 7. Minimal `.env` for the Bot

```bash
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_GUILD_ID=optional-if-developing-against-single-server

LUMINA_API_URL=http://localhost:8000     # or https://lumina-clippers-api.onrender.com

# Optional — only if you add admin-only bot commands later
ADMIN_ROLE_IDS=123,456
```

No API keys are needed to call Lumina — the `/api/discord/*` endpoints are public.

---

## 8. Sample API Client (TypeScript)

```ts
// src/lumina.ts
const BASE = process.env.LUMINA_API_URL!;

export async function listCampaigns() {
  const r = await fetch(`${BASE}/api/discord/campaigns`);
  if (!r.ok) throw new Error(`listCampaigns ${r.status}`);
  return r.json();
}

export async function getCampaign(id: number) {
  const r = await fetch(`${BASE}/api/discord/campaigns/${id}`);
  if (!r.ok) throw new Error(`getCampaign ${r.status}`);
  return r.json();
}

export async function submitClip(input: {
  campaign_id: number;
  clipper_email: string;
  post_url: string;
  discord_user_id: string;
}) {
  const r = await fetch(`${BASE}/api/discord/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return r.json(); // { status, submission_id?, submission_token?, detail }
}

export async function getClipperStats(email: string) {
  const r = await fetch(`${BASE}/api/discord/clipper/${encodeURIComponent(email)}/stats`);
  if (!r.ok) throw new Error(`getClipperStats ${r.status}`);
  return r.json();
}

export async function getSubmissionStatus(id: number) {
  const r = await fetch(`${BASE}/api/discord/submission/${id}`);
  if (!r.ok) throw new Error(`getSubmissionStatus ${r.status}`);
  return r.json();
}

export async function uploadVerification(
  submissionId: number,
  submissionToken: string,
  file: Buffer,
  filename: string,
  mime: string
) {
  const form = new FormData();
  form.append("video", new Blob([file], { type: mime }), filename);
  const r = await fetch(
    `${BASE}/api/submissions/${submissionId}/upload-verification?token=${submissionToken}`,
    { method: "POST", body: form }
  );
  return r.json();
}
```

---

## 9. Platform-side TODOs (nice-to-have)

These aren't blockers but make the bot experience cleaner. Ask the platform team:

1. **Add a Discord webhook out** — e.g. `POST` to a bot URL when a submission is verified/rejected/paid, so the bot can DM the clipper.
2. **Add `GET /api/discord/clipper/{email}/submissions`** — list recent submissions with verification status for a `/my-submissions` command.

---

## 10. Testing Locally

1. Run the backend:
   ```bash
   cd backend && uvicorn main:app --reload --port 8000
   ```
2. Hit an endpoint to confirm:
   ```bash
   curl http://localhost:8000/api/discord/campaigns
   ```
3. Point the bot at `LUMINA_API_URL=http://localhost:8000` and iterate.

---

## 11. Data Model Cheat Sheet

| Field on Submission | Meaning |
|---|---|
| `id` | Numeric submission ID — use for `/api/discord/submission/{id}` |
| `submission_token` | UUID used for verification-video upload |
| `status` | `submitted` → `payment_claimed` → `paid` / `rejected` |
| `verification_status` | `pending` → `uploaded` → `verified` / `rejected` |
| `scrape_status` | `pending` → `ok` / `failed` |
| `platform` | `tiktok` / `instagram` / `youtube` / `twitter` |
| `views`, `likes`, `comments` | Live metrics, updated by Apify worker |
| `est_earnings` | `views × CPM ÷ 1000`, capped at `max_payout` |

### Campaign status values
- `open` — accepting submissions
- `closed` — no new submissions, still visible
- `completed` — archived / historical
- `draft` — hidden from public

Only `open` shows up in `/api/discord/campaigns`; use `/api/campaigns` for open + closed + completed.

---

## 12. Error handling conventions

Discord endpoints always return **200 OK** with `{ status: "ok" | "error", detail: "..." }`. Other endpoints return standard HTTP codes (`400`, `401`, `403`, `404`). Always check the response JSON for `status === "ok"` on `/api/discord/submit`.

---

Good luck. When in doubt, open `backend/routers/discord.py` and `backend/routers/verification.py` — they're the source of truth.
