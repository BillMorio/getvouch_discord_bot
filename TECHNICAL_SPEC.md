# GetVouch Discord Bot — Technical Spec

## What This Bot Does

A Discord bot that lets clippers enter campaigns, submit content, and get verified — all without leaving Discord. Vouch handles identity verification, clipper management, and stats tracking. The bot is a thin layer that connects Discord to Vouch.

---

## The User Flow (Option B)

```
Clipper sees ad
    → Lands on campaign page (Vouch hosted)
    → Prompted to join Discord
    → Joins Discord server
    → Sees campaign embeds in Discord
    → Clicks "Enter Campaign"
    → Modal pops up: enters email + content link
    → Bot calls Vouch API → gets verification URL
    → Bot DMs clipper the verification link
    → Clipper clicks link → opens browser → completes Vouch verification
    → Vouch fires webhook back to bot
    → Bot updates clipper status in Discord
    → Clipper gets confirmation DM
```

---

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Discord    │◄───────►│   Bot Server │◄───────►│    Vouch     │
│   (Clippers) │         │  (Node.js)   │         │   Platform   │
└──────────────┘         └──────┬───────┘         └──────────────┘
                                │
                         ┌──────┴───────┐
                         │   Database   │
                         │  (Postgres)  │
                         └──────────────┘
```

**Discord** — where clippers interact (campaigns, submissions, notifications)
**Bot Server** — Node.js process running Discord.js + Express (webhook listener)
**Vouch** — handles verification, clipper identity, stats, campaign management
**Database** — maps Discord user IDs to Vouch data, tracks campaign entries

---

## What the Bot Owns vs What Vouch Owns

| Responsibility                        | Owner         |
|---------------------------------------|---------------|
| Campaign creation, config, budgets    | Vouch         |
| Clipper identity & onboarding         | Vouch         |
| Content verification (chrome ext)     | Vouch         |
| Clipper management dashboard          | Vouch         |
| Surfacing campaigns in Discord        | Bot           |
| Collecting email + content link       | Bot           |
| Generating & sending verification URL | Bot           |
| Listening for Vouch webhooks          | Bot           |
| Updating clipper status in Discord    | Bot           |
| Campaign announcements                | Bot           |
| Payment notifications (Phase 2)      | Bot           |

---

## Vouch API Integration

### SDK Setup

```javascript
import { Vouch } from "@getvouch/sdk";

const vouch = new Vouch({
  customerId: process.env.VOUCH_CUSTOMER_ID,
  apiKey: process.env.VOUCH_API_KEY,
});
```

### Generating a Verification URL

```javascript
const { verificationUrl, requestId } = await vouch.getDataSourceUrl({
  datasourceId: "your-datasource-id",           // from Vouch catalog
  redirectBackUrl: "https://yourdomain.com/done", // where clipper lands after
  webhookUrl: "https://yourdomain.com/api/webhook", // your webhook endpoint
  metadata: discordUserId,                       // maps webhook back to Discord user
  inputs: { /* data source specific */ },        // e.g. { twitter_username: "handle" }
});
```

**Returns:** `{ verificationUrl: string, requestId: string }`

### Webhook Handler

Vouch POSTs to your `webhookUrl` when verification completes.

**Auth:** Validate the `Authorization: PSK <base64-webhook-secret>` header.

**Payload:**
```json
{
  "requestId": "uuid",
  "dataSourceId": "uuid",
  "metadata": "discord-user-id-you-passed-in",
  "outputs": { /* platform-specific data */ },
  "webProofs": [
    {
      "outputs": { /* per-proof data */ },
      "presentationJson": { /* cryptographic proof */ },
      "decodedTranscript": { /* raw HTTP transcript */ }
    }
  ]
}
```

**Vouch static IPs to allowlist:** `52.59.138.51`, `3.78.83.192`

---

## Discord Components Used

### Campaign Embed Card
```
┌─────────────────────────────────────┐
│  Campaign Name                      │
│  Status: OPEN                       │
│                                     │
│  [Campaign Banner Image]            │
│                                     │
│  CPM:        $X.XX per 1k views     │
│  Max Payout: $XXX.XX                │
│  Budget:     $XXX / $XX,XXX         │
│                                     │
│  🟢 Campaign is live                │
│                                     │
│ [View Requirements] [Enter Campaign]│
└─────────────────────────────────────┘
```

### Entry Modal (on "Enter Campaign" click)
- **Field 1:** Email (short text, required)
- **Field 2:** Link to content (short text, required)

### DM to Clipper (after modal submit)
- Embed with campaign details
- Link button → `verificationUrl` from Vouch
- Message: "Click below to verify your submission"

### Confirmation DM (after webhook received)
- Embed confirming verification is complete
- Status update

---

## Credentials Required

| Credential              | Source                          |
|--------------------------|---------------------------------|
| Discord Bot Token        | discord.com/developers          |
| Discord Application ID   | discord.com/developers          |
| Vouch Customer ID        | app.getvouch.io (sandbox + prod)|
| Vouch API Key            | app.getvouch.io                 |
| Vouch Webhook Secret     | app.getvouch.io                 |
| Data Source ID(s)        | app.getvouch.io/catalog         |

### Discord Bot Permissions Needed
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Use Slash Commands
- Manage Roles (for updating clipper status)

### Discord Privileged Intents
- Message Content Intent
- Server Members Intent

---

## Database Schema (Minimal)

```
clippers
  - id (primary key)
  - discord_user_id (unique)
  - email
  - vouch_request_id
  - verification_status (pending | verified | failed)
  - verified_at
  - created_at

campaign_entries
  - id (primary key)
  - clipper_id (foreign key → clippers)
  - campaign_id
  - content_link
  - vouch_request_id
  - status (submitted | verifying | verified | paid)
  - submitted_at

campaigns
  - id (primary key)
  - name
  - description
  - banner_image_url
  - cpm
  - max_payout
  - budget_total
  - budget_used
  - status (draft | live | paused | completed)
  - created_at
```

---

## Tech Stack

- **Runtime:** Node.js
- **Discord Library:** discord.js
- **HTTP Server:** Express (for webhook endpoint)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Vouch SDK:** @getvouch/sdk
- **Hosting:** Railway / Render / Fly.io

---

## Phases

### Phase 1 (Core)
- Campaign embeds in Discord
- Entry modal (email + content link)
- Vouch verification URL generation + DM
- Webhook listener + status updates
- Campaign announcements

### Phase 2 (Payments)
- Payment tracking in database
- Payment notification DMs
- Dispute flow via Discord

---

## Open Questions for Client

1. **Which Vouch data sources?** TikTok, Instagram, YouTube — each has multiple options (ownership, stats, demographics, video metrics). Need to know which ones.
2. **Dashboard filter (US/EU)?** Pending client decision.
3. **Payment method?** Stripe Connect, PayPal, or manual tracking?
4. **Who creates campaigns?** Admin commands in Discord, or managed directly in Vouch?
