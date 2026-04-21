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

For follow-up "check status" commands AND for rendering state-driven action buttons.

**Response**
```json
{
  "id": 4821,
  "post_url": "https://www.tiktok.com/@user/video/7312…",
  "platform": "tiktok",
  "views": 14532,
  "likes": 302,
  "comments": 18,
  "est_earnings": 21.80,
  "status": "submitted",                  // submitted | payment_claimed | paid | rejected
  "scrape_status": "ok",                  // pending | ok | failed
  "verification_status": "pending",       // pending | uploaded | verified | rejected
  "has_video": false,
  "rejection_reason": "",                 // populated only when verification_status == rejected
  "clipper_email": "user@example.com",
  "campaign_id": 16,
  "discord_user_id": "123456789012345678",
  "created_at": "2026-04-20T12:34:56"
}
```

**Use for stateful buttons** (see §5.7):
- `has_video == false` → show **Upload Video Proof**
- `has_video && verification_status in (uploaded, verified)` → show **Claim Payment**
- `status == payment_claimed` → show disabled **Payment Pending**
- `status == paid` → show disabled **Paid**
- `status == rejected || verification_status == rejected` → show disabled **Rejected** with `rejection_reason`

### 4.6 Upload verification video (recommended — email auth)
`POST /api/discord/submission/{submission_id}/upload-verification`

**Use this from the Discord bot.** Auth is by `clipper_email` so the bot never has to persist submission tokens across restarts.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `video` | file | yes | mp4 / quicktime / webm, max 100 MB |
| `clipper_email` | string | yes | Must match `submission.clipper_email` (case-insensitive) |
| `discord_user_id` | string | no | If sent, must also match `submission.discord_user_id` (defence in depth) |

**Response 200**
```json
{
  "ok": true,
  "submission_id": 184,
  "verification_status": "uploaded",
  "message": "Verification video uploaded successfully"
}
```

**Errors**
| Code | Body | Meaning |
|---|---|---|
| 400 | `{ "detail": "Invalid email" }` | Malformed email |
| 400 | `{ "detail": "Missing video" }` | No file attached |
| 400 | `{ "detail": "Unsupported video type '...'. Allowed: mp4, quicktime, webm" }` | Wrong MIME |
| 403 | `{ "detail": "Email does not match submission" }` | Ownership check failed |
| 403 | `{ "detail": "Discord user does not match submission" }` | Optional `discord_user_id` didn't match |
| 404 | `{ "detail": "Submission not found" }` | |
| 413 | `{ "detail": "File too large" }` | > 100 MB |

### 4.6b Upload verification video (legacy — token auth)
`POST /api/submissions/{submission_id}/upload-verification?token={submission_token}`

Original endpoint, kept for the web app. Same multipart shape (just `video`). Response: `{ "status": "uploaded", "message": "..." }`. Prefer §4.6 for the bot.

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

### 4.9 Get clipper payment method
`GET /api/discord/clipper/{email}/payment-method`

Before showing **Claim Payment**, check whether the clipper has a payment method set.

**Response**
```json
{
  "method": "paypal",                       // "whop" | "paypal" | "solana" | null
  "details": { "paypal_email": "user@example.com" },
  "has_method": true
}
```

Returns `{ method: null, details: null, has_method: false }` if the clipper doesn't exist or has no method set.

### 4.10 Set / update clipper payment method
`POST /api/discord/clipper/{email}/payment-method`

Auto-creates the clipper record if new. Exactly one method per clipper.

**Body** (only the relevant field for the chosen method is required)
```json
{
  "method": "paypal",                       // "whop" | "paypal" | "solana"
  "paypal_email": "user@example.com",       // for method=paypal
  "whop_username": "",                      // for method=whop
  "solana_address": "",                     // for method=solana
  "discord_user_id": "123456789012345678"
}
```

**Response**
```json
{ "ok": true, "method": "paypal" }
```

**Errors**: 400 if the method is invalid or the matching credential field is empty.

### 4.11 Claim payment for a submission
`POST /api/discord/submission/{submission_id}/claim-payment`

**Body**
```json
{ "clipper_email": "user@example.com" }
```

**Response**
```json
{ "ok": true, "submission_id": 4821, "status": "payment_claimed" }
```

**Errors**
| Code | Meaning |
|---|---|
| 403 | Submission doesn't belong to this email |
| 400 | Already paid / already claimed |
| 400 | Upload a proof video before claiming payment (admin verifies it later) |
| 400 | No payment method set (prompt the user to run §4.10 first) |
| 404 | Submission not found |

---
### 4.12 List a clipper's submissions (by email)
`GET /api/discord/clipper/{email}/submissions`

For `/mysubmissions` — paginated list, newest first. Each row has the same shape as `GET /api/discord/submission/{id}` so the bot reuses one card renderer.

**Query params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 10 | Max 25 |
| `offset` | int | 0 | For pagination |
| `status` | string | — | Filter by `submitted` / `payment_claimed` / `paid` / `rejected` |

**Response**
```json
{
  "email": "clipper@example.com",
  "total": 12,
  "limit": 10,
  "offset": 0,
  "submissions": [
    {
      "id": 4821,
      "campaign_id": 17,
      "post_url": "https://www.tiktok.com/@user/video/123",
      "platform": "tiktok",
      "views": 12050,
      "likes": 430,
      "comments": 21,
      "est_earnings": 3.61,
      "status": "submitted",
      "scrape_status": "ok",
      "verification_status": "pending",
      "has_video": false,
      "rejection_reason": "",
      "clipper_email": "clipper@example.com",
      "discord_user_id": "123456789012345678",
      "created_at": "2026-04-19T14:22:11"
    }
  ]
}
```

**Errors**
- `400` — `{ "detail": "Invalid email" }` or invalid `status` value
- `404` — `{ "detail": "Clipper not found" }`

### 4.13 List a clipper's submissions (by Discord user ID)
`GET /api/discord/user/{discord_user_id}/submissions`

Identical to §4.12 but keyed off Discord user ID — use this for `/mysubmissions` so clippers don't have to type their email. Pull the ID from `interaction.user.id`.

**Same query params** (`limit`, `offset`, `status`).

**Response** — same shape as §4.12 plus `discord_user_id` at the top and the resolved `email` of the owner.

**Errors**
- `400` — `{ "detail": "Invalid discord_user_id" }` (must be digits)
- `404` — `{ "detail": "No submissions for this Discord user" }`


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

### 5.7 Stateful submission-card buttons
Every submission embed should show exactly one primary action button, derived from `GET /api/discord/submission/{id}`:

| Condition | Button | Action |
|---|---|---|
| `has_video == false` | 📹 **Upload Video Proof** | Prompt user to attach a video → POST `/api/discord/submission/{id}/upload-verification` with `clipper_email` |
| `has_video && status == submitted` | 💰 **Claim Payment** | Check `§4.9` payment method → if missing, open method-setup modal (§4.10) → then POST `§4.11` (`verification_status` can be `pending`, `uploaded`, or `verified` — admin verifies later) |
| `status == payment_claimed` | ⏳ **Payment Pending** (disabled) | Tooltip: "Payment has been claimed and is awaiting processing" |
| `status == paid` | ✅ **Paid** (disabled) | Tooltip: "You've been paid for this submission" |
| `verification_status == rejected` | ❌ **Rejected** (disabled) | Show `rejection_reason` |

Refresh the card by re-calling `GET /api/discord/submission/{id}` after any state-changing action.

### 5.8 Payment-method setup flow
When a clipper clicks **Claim Payment** and `has_method == false`:
1. Open a modal with a dropdown: **Payment Method** → Whop / PayPal / Solana
2. Show the one relevant text field based on selection:
   - Whop → `Whop username`
   - PayPal → `PayPal email`
   - Solana → `Solana wallet address`
3. On submit, call `§4.10` `POST /api/discord/clipper/{email}/payment-method`
4. On success, immediately retry the `§4.11` `claim-payment` call

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

export async function getPaymentMethod(email: string) {
  const r = await fetch(`${BASE}/api/discord/clipper/${encodeURIComponent(email)}/payment-method`);
  if (!r.ok) throw new Error(`getPaymentMethod ${r.status}`);
  return r.json(); // { method, details, has_method }
}

export async function setPaymentMethod(email: string, body: {
  method: "whop" | "paypal" | "solana";
  whop_username?: string;
  paypal_email?: string;
  solana_address?: string;
  discord_user_id?: string;
}) {
  const r = await fetch(`${BASE}/api/discord/clipper/${encodeURIComponent(email)}/payment-method`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function listClipperSubmissions(
  email: string,
  opts: { limit?: number; offset?: number; status?: string } = {}
) {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.offset) qs.set("offset", String(opts.offset));
  if (opts.status) qs.set("status", opts.status);
  const r = await fetch(
    `${BASE}/api/discord/clipper/${encodeURIComponent(email)}/submissions?${qs}`
  );
  if (!r.ok) throw new Error(`listClipperSubmissions ${r.status}`);
  return r.json(); // { email, total, limit, offset, submissions: [...] }
}

export async function listUserSubmissions(
  discordUserId: string,
  opts: { limit?: number; offset?: number; status?: string } = {}
) {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.offset) qs.set("offset", String(opts.offset));
  if (opts.status) qs.set("status", opts.status);
  const r = await fetch(
    `${BASE}/api/discord/user/${encodeURIComponent(discordUserId)}/submissions?${qs}`
  );
  if (!r.ok) throw new Error(`listUserSubmissions ${r.status}`);
  return r.json();
}

export async function claimPayment(submissionId: number, clipperEmail: string) {
  const r = await fetch(`${BASE}/api/discord/submission/${submissionId}/claim-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipper_email: clipperEmail }),
  });
  return r.json(); // { ok, submission_id, status } or { detail }
}

export async function uploadVerification(
  submissionId: number,
  clipperEmail: string,
  file: Buffer,
  filename: string,
  mime: string,
  discordUserId?: string,
) {
  const form = new FormData();
  form.append("video", new Blob([file], { type: mime }), filename);
  form.append("clipper_email", clipperEmail);
  if (discordUserId) form.append("discord_user_id", discordUserId);
  const r = await fetch(
    `${BASE}/api/discord/submission/${submissionId}/upload-verification`,
    { method: "POST", body: form }
  );
  return r.json(); // { ok, submission_id, verification_status, message } or { detail }
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
