const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { CHANNELS } = require("../config");

function channelRef(id, fallbackName) {
  return id ? `<#${id}>` : `#${fallbackName}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show which slash commands to use in which channel"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🧭 Where do I run what?")
      .setColor(0x5865f2)
      .setDescription(
        "Each channel has its own purpose. Tap a channel below to jump there."
      )
      .addFields(
        {
          name: `📺 ${channelRef(CHANNELS.liveCampaigns, "live-campaigns")}`,
          value: "Browse and enter active campaigns.\n`/campaigns`",
        },
        {
          name: `📣 ${channelRef(CHANNELS.newCampaigns, "new-campaigns")}`,
          value: "Auto-announcements when new campaigns go live. Read-only.",
        },
        {
          name: `✅ ${channelRef(CHANNELS.verification, "verification")}`,
          value: "Track your submissions and upload proof.\n`/mysubmissions` · `/submission`",
        },
        {
          name: `⚙️ ${channelRef(CHANNELS.mySettings, "my-settings")}`,
          value: "Manage your payment method and stats.\n`/set-payment` · `/mystats`",
        }
      )
      .setFooter({ text: "Tip: /help works anywhere." });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
