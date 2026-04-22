const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

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
  const list = Array.isArray(platforms) ? platforms : (platforms || "").split(",");
  return list.map((p) => icons[p.trim()] || p.trim()).join("  •  ");
}

function buildCampaignCard(c) {
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
            `**Remaining:** \`$${(remaining || 0).toLocaleString()}\`\n` +
            progressBar(c.budget_used, c.budget_total)
          : "No budget cap",
        inline: true,
      },
      { name: "​", value: "​", inline: false },
      { name: "🌐 Accepted Platforms", value: platformLine(c.accepted_platforms) }
    )
    .setFooter({ text: `Campaign #${c.id}` })
    .setTimestamp(c.created_at ? new Date(c.created_at) : new Date());

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

  return { embeds: [embed], components: [row] };
}

module.exports = { buildCampaignCard };
