const { MessageFlags } = require("discord.js");

// Ensures the interaction came from one of the allowed channel IDs. Returns
// true if allowed; otherwise sends an ephemeral nudge pointing at the right
// channel(s) and returns false. Empty-string IDs are skipped so unconfigured
// channels don't accidentally lock everything down.
async function requireChannel(interaction, ...allowedChannelIds) {
  const allowed = allowedChannelIds.filter(Boolean);
  if (allowed.length === 0) return true;
  if (allowed.includes(interaction.channelId)) return true;

  const targets = allowed.map((id) => `<#${id}>`).join(" or ");
  const payload = {
    content: `This command only works in ${targets}.`,
    flags: MessageFlags.Ephemeral,
  };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
  return false;
}

module.exports = { requireChannel };
