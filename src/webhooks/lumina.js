const express = require("express");
const crypto = require("crypto");
const { CHANNELS } = require("../config");
const { buildCampaignCard } = require("../lib/campaignCard");

const FIVE_MINUTES_S = 5 * 60;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUPE_MAX = 1000;

// id -> expiresAt (ms). Map preserves insertion order so the oldest is always first.
const seen = new Map();

function pruneSeen() {
  const now = Date.now();
  for (const [id, expires] of seen) {
    if (expires > now) break;
    seen.delete(id);
  }
  while (seen.size >= DEDUPE_MAX) {
    const oldest = seen.keys().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
}

function isDuplicate(id) {
  const expires = seen.get(id);
  if (!expires) return false;
  if (expires <= Date.now()) {
    seen.delete(id);
    return false;
  }
  return true;
}

function rememberDelivery(id) {
  pruneSeen();
  seen.set(id, Date.now() + DEDUPE_TTL_MS);
}

function parseSignatureHeader(header) {
  if (!header || typeof header !== "string") return null;
  const parts = header.split(",").map((p) => p.trim());
  const out = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k && v) out[k] = v;
  }
  if (!out.t || !out.v1) return null;
  return out;
}

function timingSafeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function mountLuminaWebhook(app, client) {
  const secret = process.env.LUMINA_WEBHOOK_SECRET;

  // Dispatcher: add new event handlers here as the API ships more webhooks.
  const handlers = {
    "campaign.created": async (data) => {
      const channelId = CHANNELS.newCampaigns;
      if (!channelId) {
        console.warn("CHANNEL_NEW_CAMPAIGNS unset — dropping campaign.created");
        return;
      }
      if (!client.isReady()) {
        throw new Error("Discord client not ready");
      }
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased?.()) {
        throw new Error(`Channel ${channelId} is not text-based`);
      }
      await channel.send(buildCampaignCard(data));
    },
  };

  app.post(
    "/webhooks/lumina",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      if (!secret) {
        console.error("LUMINA_WEBHOOK_SECRET not set — rejecting webhook");
        return res.status(500).json({ error: "secret_not_configured" });
      }

      const sig = parseSignatureHeader(req.get("X-Lumina-Signature"));
      if (!sig) {
        return res.status(400).json({ error: "bad_signature_header" });
      }

      const ts = parseInt(sig.t, 10);
      if (!Number.isFinite(ts)) {
        return res.status(400).json({ error: "bad_timestamp" });
      }
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - ts) > FIVE_MINUTES_S) {
        return res.status(401).json({ error: "stale_timestamp" });
      }

      const raw = req.body; // Buffer, raw bytes
      if (!Buffer.isBuffer(raw) || raw.length === 0) {
        return res.status(400).json({ error: "empty_body" });
      }

      const computed = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (!timingSafeHexEqual(computed, sig.v1)) {
        return res.status(401).json({ error: "bad_signature" });
      }

      let envelope;
      try {
        envelope = JSON.parse(raw.toString("utf8"));
      } catch {
        return res.status(400).json({ error: "bad_json" });
      }

      if (!envelope.id || typeof envelope.id !== "string") {
        return res.status(400).json({ error: "missing_id" });
      }

      if (isDuplicate(envelope.id)) {
        return res.status(200).json({ ok: true, dedup: true });
      }

      const handler = handlers[envelope.event];
      if (!handler) {
        // Unknown event — accept and remember so retries don't keep noisying us up
        rememberDelivery(envelope.id);
        console.warn(`Lumina webhook: unhandled event "${envelope.event}"`);
        return res.status(200).json({ ok: true, unhandled: true });
      }

      try {
        await handler(envelope.data || {});
      } catch (err) {
        // Don't remember — let Lumina retry for transient failures (Discord down, channel
        // unreachable, bot restarting, etc.)
        console.error(`Lumina webhook handler error (${envelope.event}):`, err);
        return res.status(500).json({ error: "handler_failed" });
      }

      rememberDelivery(envelope.id);
      return res.status(200).json({ ok: true });
    }
  );
}

module.exports = { mountLuminaWebhook };
