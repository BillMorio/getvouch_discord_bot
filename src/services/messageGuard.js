const { CHANNELS } = require("../config");

// Channels where members should only run slash commands and click buttons —
// no free-form chat. Any non-bot, non-system message posted here is deleted
// silently, keeping the channel clean while preserving slash-command access.
//
// Note: platform-tutorial is intentionally NOT in this list. It's a content
// channel where admin-posted tutorials need to persist.
const SLASH_ONLY_CHANNEL_IDS = new Set(
  [
    CHANNELS.liveCampaigns,
    CHANNELS.verification,
    CHANNELS.mySettings,
  ].filter(Boolean)
);

function startMessageGuard(client) {
  client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    if (!SLASH_ONLY_CHANNEL_IDS.has(message.channelId)) return;
    if (message.author.bot) return;
    if (message.system) return;
    try {
      await message.delete();
    } catch (err) {
      console.error(
        `Message guard: failed to delete in #${message.channel.name}: ${err.message}`
      );
    }
  });
}

module.exports = { startMessageGuard };
