const { CHANNELS } = require("../config");
const { listCampaigns } = require("../api");
const { buildCampaignCard } = require("../lib/campaignCard");

const FIVE_MIN_MS = 5 * 60 * 1000;
const PURGE_SCAN_LIMIT = 100;

// campaignId -> Discord message id
const cardMessages = new Map();
let syncing = false;
let bootstrapped = false;

async function getFeedChannel(client) {
  const id = CHANNELS.liveCampaigns;
  if (!id) return null;
  if (!client.isReady()) return null;
  try {
    const channel = await client.channels.fetch(id);
    if (!channel?.isTextBased?.()) return null;
    return channel;
  } catch (err) {
    console.warn("Live feed: fetch channel failed:", err.message);
    return null;
  }
}

async function purgeBotMessages(channel, botUserId) {
  try {
    const messages = await channel.messages.fetch({ limit: PURGE_SCAN_LIMIT });
    const mine = messages.filter((m) => m.author.id === botUserId);
    for (const msg of mine.values()) {
      await msg.delete().catch(() => {});
    }
  } catch (err) {
    console.warn("Live feed: purge failed:", err.message);
  }
}

async function syncLiveCampaignsFeed(client) {
  if (syncing) return;
  syncing = true;
  try {
    const channel = await getFeedChannel(client);
    if (!channel) {
      if (!CHANNELS.liveCampaigns) {
        console.warn("Live feed: CHANNEL_LIVE_CAMPAIGNS unset — feed disabled");
      }
      return;
    }

    if (!bootstrapped) {
      await purgeBotMessages(channel, client.user.id);
      bootstrapped = true;
    }

    let campaigns;
    try {
      campaigns = await listCampaigns();
    } catch (err) {
      console.error("Live feed: listCampaigns failed:", err.message);
      return;
    }
    if (!Array.isArray(campaigns)) campaigns = [];

    const currentIds = new Set(campaigns.map((c) => c.id));

    for (const c of campaigns) {
      const payload = buildCampaignCard(c);
      const existingId = cardMessages.get(c.id);
      if (existingId) {
        try {
          const msg = await channel.messages.fetch(existingId);
          await msg.edit(payload);
          continue;
        } catch {
          // Message gone — fall through and repost
          cardMessages.delete(c.id);
        }
      }
      try {
        const sent = await channel.send(payload);
        cardMessages.set(c.id, sent.id);
      } catch (err) {
        console.error(`Live feed: failed to post campaign #${c.id}:`, err.message);
      }
    }

    for (const [cid, msgId] of cardMessages) {
      if (currentIds.has(cid)) continue;
      try {
        const msg = await channel.messages.fetch(msgId);
        await msg.delete();
      } catch {
        // already gone; fine
      }
      cardMessages.delete(cid);
    }
  } finally {
    syncing = false;
  }
}

function startLiveCampaignsFeed(client) {
  syncLiveCampaignsFeed(client).catch((err) =>
    console.error("Live feed: initial sync failed:", err)
  );
  setInterval(() => {
    syncLiveCampaignsFeed(client).catch((err) =>
      console.error("Live feed: scheduled sync failed:", err)
    );
  }, FIVE_MIN_MS);
}

module.exports = { startLiveCampaignsFeed, syncLiveCampaignsFeed };
