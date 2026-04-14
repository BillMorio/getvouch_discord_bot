# Endpoints Needed — Lumina Discord Bot Integration (Phase 1)

> **Identity model:** Clippers are identified by email. the email is the identity. The bot maintains its own local mapping of Discord user → email, so Lumina only ever deals with emails and discord_user_id is not needed.

---

## 1. Campaigns

**`GET /campaigns`** — List all open campaigns (for rendering Discord embed cards)
Fields per campaign: `id`, `name`, `description`, `thumbnail_url`, `accepted_platforms`, `cpm_rate`, `max_payout`, `budget_total`, `budget_used`, `requirements_url`, `status`, `created_at`

**`GET /campaigns/{campaign_id}`** — Fetch one campaign's details + current submission count

---

## 2. Submissions

**`POST /submissions`** — Record a single submission
Accepts: `campaign_id`, `clipper_email`, `post_url`
Returns: `submission_id`, `status`, auto-detected platform, error message if rejected (duplicate, non-accepted platform, etc.)

**`POST /submissions/bulk`** — Record multiple submissions in one call
Accepts: `campaign_id`, `clipper_email`, `post_urls` (array of URLs — all under the same clipper email)
Returns: Array of results, one per URL, each with `submission_id`, `status` (ok/error), `detail`, auto-detected platform. **Partial success is allowed** — if a clipper pastes 10 links and 2 are duplicates, the other 8 should still go through so the bot can DM them a summary.

**`GET /submissions/{submission_id}`** — Get a single submission's status + metrics (views, likes, comments, est_earnings, verification status)

**`GET /clippers/{email}/submissions`** — List all submissions for a clipper by email (for a "my submissions" command in Discord)

**`PATCH /submissions/{submission_id}/verification`** — Push verification results back to Lumina after Vouch's webhook fires
Accepts: `verification_status` (verified | failed), `verification_request_id`, `outputs` (demographic data from Vouch webhook: handle, follower_count, countries, etc.)
Returns: Updated submission record

---

## 3. Clipper Stats

**`GET /clippers/{email}/stats`** — Aggregated stats by email: `total_submissions`, `total_views`, `total_likes`, `total_comments`, `total_earnings`, `platforms`, `campaigns`

---

## 4. Webhooks (Lumina → Bot)

**`campaign.created`** — Lumina tells the bot when a new campaign goes live → bot posts an announcement in `#campaigns`

POST to a single bot endpoint: `https://<bot-host>/api/webhook/lumina`
Include an `Authorization` header or HMAC signature for validation.

> **Note:** We don't need webhooks for `submission.verified`, `submission.rejected`, or `submission.stats_updated` — the bot will receive those events directly from Vouch (see "Verification" below) or poll the submission endpoint.

---

## 5. Auth

All endpoints accept `Authorization: Bearer <lumina-api-key>` for authentication.

---

## 6. Verification (Handled Directly via Vouch)

**The bot will call Vouch's API directly** — we already have sandbox credentials working. Lumina does NOT need to wrap Vouch's verification API.

**Flow:**
1. Bot calls `POST https://app.getvouch.io/api/proof-request` with Vouch credentials → gets `verificationUrl` + `requestId`
2. Bot DMs clipper the verification URL
3. Clipper completes verification in browser
4. Vouch POSTs webhook directly to the bot
5. Bot validates `Authorization: PSK <webhook-secret>` header
6. Bot calls `PATCH /submissions/{submission_id}/verification` on Lumina to push the verification result into Lumina's database

**What we need from Lumina for this to work:** just the `PATCH /submissions/{submission_id}/verification` endpoint listed in Section 2.

---

## Notes for the Lumina team

- **Bulk submissions must support partial success** — one bad URL shouldn't fail the whole batch. Return per-URL results so the bot can show clippers exactly what went through and what didn't.
- **Rate limits** — please share any rate limits so we can implement backoff correctly.
- **Sandbox vs production** — does Lumina have separate environments? The bot will need both.
- **Verification is handled via direct Vouch calls**, not wrapped by Lumina. Lumina just needs to accept the verification result via the `PATCH` endpoint so it ends up in the dashboard.

