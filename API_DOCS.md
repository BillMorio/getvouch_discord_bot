# Lumina Clippers — Discord Bot API

Base URL: https://lumina-clippers-api.onrender.com

No authentication required (will be added later).

## 1. List Open Campaigns

GET /api/discord/campaigns

Response — 200 OK:
```json
[
  {
    "id": 6,
    "name": "King Jester",
    "slug": "king-jester",
    "description": "Clip and share King Jester content",
    "thumbnail_url": "",
    "accepted_platforms": "instagram,tiktok,youtube,twitter",
    "cpm_rate": 5.0,
    "max_payout": 500.0,
    "budget_total": 10000.0,
    "budget_used": 0.0,
    "requirements_url": "",
    "created_at": "2026-03-19T10:30:00"
  }
]
```

## 2. Get Single Campaign

GET /api/discord/campaigns/{campaign_id}

Same fields as list, plus `submission_count`. Returns 404 if not found/not open.

## 3. Submit Campaign Entry

POST /api/discord/submit
Content-Type: application/json

Request:
```json
{
  "campaign_id": 6,
  "clipper_email": "clipper@example.com",
  "post_url": "https://www.instagram.com/reel/ABC123/",
  "discord_user_id": "123456789012345678"
}
```

Response:
```json
{
  "status": "ok",
  "submission_id": 82,
  "detail": "Submission recorded for instagram — scraping stats in background"
}
```

Error:
```json
{
  "status": "error",
  "submission_id": null,
  "detail": "This URL has already been submitted to this campaign"
}
```

- Auto-detects platform from URL
- Rejects unrecognized/non-accepted platforms
- Deduplicates (same URL can't be submitted twice to same campaign)
- Auto-creates Clipper account if email is new
- Kicks off background Apify scrape for views/likes/comments

## 4. Clipper Stats

GET /api/discord/clipper/{email}/stats

Response:
```json
{
  "email": "clipper@example.com",
  "total_submissions": 4,
  "total_views": 66350,
  "total_likes": 412,
  "total_comments": 38,
  "total_earnings": 15.50,
  "platforms": ["instagram", "youtube"],
  "campaigns": [5, 6]
}
```

Returns 404 if no submissions found.

## 5. Submission Status

GET /api/discord/submission/{submission_id}

Response:
```json
{
  "id": 82,
  "post_url": "https://www.instagram.com/reel/ABC123/",
  "platform": "instagram",
  "views": 30123,
  "likes": 180,
  "comments": 12,
  "est_earnings": 7.50,
  "status": "awaiting_stats",
  "scrape_status": "success",
  "discord_user_id": "123456789012345678",
  "created_at": "2026-04-09T10:30:00"
}
```

Status values: awaiting_stats, stats_verified, paid, rejected
Scrape status: pending, success, failed
