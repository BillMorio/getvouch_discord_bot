# Discord Clipper Management Bot - Full Scope & Flow

## What This Is

The bot IS the clipper management platform. Discord IS the UI. Vouch is ONLY the verification step.

## The End-to-End Flow

1. Clipper sees ad → lands on campaign page (external, not our concern)
2. Prompted to join Discord → they join the Lumina Clippers server
3. In Discord, they see a campaign dashboard — embedded campaign cards showing live campaigns (name, CPM, max payout, budget, status)
4. Clipper clicks "Enter Campaign" → modal pops up asking for email + content link
5. Bot stores the submission → sends clipper a DM with a Vouch verification URL
6. Clipper opens URL → completes verification in browser (Vouch handles this — browser extension or mobile)
7. Vouch fires webhook → bot receives it, validates PSK auth, reads demographic data + verification result
8. Bot updates clipper status → confirms in Discord (DM + status change)
9. Phase 2: Payment tracking + notifications + disputes, all in Discord

## Client's Finalised Scope

- Clipper clicks ad → lands on campaign directly, no pre-entry verification gate
- Throughout the campaign entry flow → prompted to join Discord to hear about future campaigns
- They join Discord → campaign landing page is embedded and visible within Discord for easy access
- Everything from that point happens fully within Discord: entering campaigns, submitting and verifying videos, getting paid

## What the Bot Needs to Handle

- Campaign dashboard embedded/plugged into Discord so clippers can browse and enter campaigns without leaving
- Video submission flow inside Discord
- Verification of submitted videos via Vouch triggered through Discord
- Payment processing and notifications through Discord
- Campaign announcements posted in Discord when new campaigns go live

## Vouch Integration (How It Works)

- Discord bot makes a single call to Vouch → generates a verification URL → clipper is redirected to complete verification via browser extension or mobile
- Once verification is done, Vouch fires a webhook back with the clipper's demographic data
- Bot reads the webhook and updates the clipper's status automatically
- Vouch docs: https://docs.getvouch.io/getting-started/first-steps
- Webhooks: https://docs.getvouch.io/getting-started/verifying-webproofs

## What the Bot Owns vs What Vouch Owns

**Bot owns:**
- Campaign dashboard (embeds in a channel)
- Entry flow (modals, buttons)
- Submission tracking (database)
- Triggering Vouch verification + receiving webhook
- Campaign announcements
- Payment flow (Phase 2)

**Vouch owns:**
- The actual verification page/experience
- Demographic data collection
- Webhook with results

## What Was Dropped

- No pre-entry verification gate before joining the server
- No tier-based channel separation — clippers enter campaigns directly, no filtering at entry level
- Dashboard filter (all clips vs US/EU only) still pending — client decision TBD

## Phases

- Phase 1: Campaign dashboard embedded in Discord + entry and submission flow working end to end
- Phase 2: Payments and disputes handled fully through Discord once core flow is stable

## Mock Vouch Clone (For Local Testing)

Instead of using the real Vouch platform during development, we build a mock server that simulates:
- An endpoint the bot calls to get a verification URL
- A web page at that URL where we click "verify" to simulate completion
- A webhook POST back to the bot with fake demographic/verification data
