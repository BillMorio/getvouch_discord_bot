const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { listCampaigns } = require("../api");
const { requireChannel } = require("../lib/guards");
const { CHANNELS } = require("../config");

function progressBar(used, total, length = 10) {
  if (!total) return "";
  const ratio = Math.min(used / total, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty) + ` ${Math.round(ratio * 100)}%`;
}

function platformLine(platforms) {
  const icons = {
    instagram: "📷 Instagram",
    tiktok: "🎵 TikTok",
    youtube: "▶️ YouTube",
    twitter: "🐦 Twitter",
  };
  const list = Array.isArray(platforms) ? platforms : platforms.split(",");
  return list.map((p) => icons[p.trim()] || p.trim()).join("  •  ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("campaigns")
    .setDescription("Browse open campaigns"),

  async execute(interaction) {
    if (!(await requireChannel(interaction, CHANNELS.liveCampaigns))) return;
    await interaction.deferReply();

    let campaigns;
    try {
      campaigns = await listCampaigns();
    } catch (err) {
      console.error("listCampaigns error:", err);
      return interaction.editReply("Failed to load campaigns. Try again later.");
    }

    if (!campaigns.length) {
      return interaction.editReply("No open campaigns right now. Check back soon!");
    }

    for (const c of campaigns) {
      const hasBudget = c.budget_total != null && c.budget_total > 0;
      const remaining = hasBudget ? c.budget_total - c.budget_used : null;

      const embed = new EmbedBuilder()
        .setTitle(`🎬  ${c.name}`)
        .setDescription(
          `${c.description || "No description"}\n──────────────────────────────`
        )
        .setColor(0x7c3aed)
        .addFields(
          {
            name: "💰 Payout",
            value:
              `**CPM:** \`$${(c.cpm_rate || 0).toFixed(2)}\` per 1k views\n` +
              `**Max Payout:** \`$${(c.max_payout || 0).toFixed(2)}\``,
            inline: true,
          },
          {
            name: "📊 Budget",
            value: hasBudget
              ? `**Total:** \`$${c.budget_total.toLocaleString()}\`\n` +
                `**Remaining:** \`$${remaining.toLocaleString()}\`\n` +
                progressBar(c.budget_used, c.budget_total)
              : "No budget cap",
            inline: true,
          },
          { name: "​", value: "​", inline: false },
          { name: "🌐 Accepted Platforms", value: platformLine(c.accepted_platforms) }
        )
        .setFooter({ text: `Campaign #${c.id}` })
        .setTimestamp(new Date(c.created_at));

      if (c.thumbnail_url) embed.setImage(c.thumbnail_url);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`enter_campaign_${c.id}`)
          .setLabel("🚀 Enter Campaign")
          .setStyle(ButtonStyle.Success)
      );

      if (c.requirements_url) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("📋 Requirements")
            .setStyle(ButtonStyle.Link)
            .setURL(c.requirements_url)
        );
      }

      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    await interaction.editReply(`✨ Found **${campaigns.length}** open campaign(s) above.`);
  },
};
