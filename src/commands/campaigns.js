const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { fetchCampaigns } = require("../api");

function buildProgressBar(used, total, length = 10) {
  const ratio = Math.min(used / total, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty) + ` ${Math.round(ratio * 100)}%`;
}

function platformEmojis(platforms) {
  const icons = {
    instagram: "\uD83D\uDCF7 Instagram",
    tiktok: "\uD83C\uDFB5 TikTok",
    youtube: "\u25B6\uFE0F YouTube",
    twitter: "\uD83D\uDC26 Twitter",
  };
  const list = Array.isArray(platforms) ? platforms : platforms.split(",");
  return list
    .map((p) => icons[p.trim()] || p.trim())
    .join("  \u2022  ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("campaigns")
    .setDescription("Browse open campaigns"),

  async execute(interaction) {
    await interaction.deferReply();

    let campaigns;
    try {
      campaigns = await fetchCampaigns();
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      return interaction.editReply("Failed to load campaigns. Try again later.");
    }

    if (!campaigns.length) {
      return interaction.editReply("No open campaigns right now. Check back soon!");
    }

    for (const campaign of campaigns) {
      const hasBudget = campaign.budget_total != null && campaign.budget_total > 0;
      const budgetRemaining = hasBudget ? campaign.budget_total - campaign.budget_used : null;

      const embed = new EmbedBuilder()
        .setTitle(`\uD83C\uDFAC  ${campaign.name}`)
        .setDescription(
          `${campaign.description || "No description"}\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`
        )
        .setColor(0x7c3aed)
        .addFields(
          {
            name: "\uD83D\uDCB0  Payout",
            value: [
              `**CPM:** \`$${(campaign.cpm_rate || 0).toFixed(2)}\` per 1k views`,
              `**Max Payout:** \`$${(campaign.max_payout || 0).toFixed(2)}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "\uD83D\uDCCA  Budget",
            value: hasBudget
              ? [
                  `**Total:** \`$${campaign.budget_total.toLocaleString()}\``,
                  `**Remaining:** \`$${budgetRemaining.toLocaleString()}\``,
                  buildProgressBar(campaign.budget_used, campaign.budget_total),
                ].join("\n")
              : "No budget cap",
            inline: true,
          },
          { name: "\u200B", value: "\u200B", inline: false },
          {
            name: "\uD83C\uDF10  Accepted Platforms",
            value: platformEmojis(campaign.accepted_platforms),
            inline: false,
          }
        )
        .setFooter({
          text: `Campaign #${campaign.id}  \u2022  Posted`,
        })
        .setTimestamp(new Date(campaign.created_at));

      if (campaign.thumbnail_url) {
        embed.setImage(campaign.thumbnail_url);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`enter_campaign_${campaign.id}`)
          .setLabel("\uD83D\uDE80 Enter Campaign")
          .setStyle(ButtonStyle.Success),
      );

      if (campaign.requirements_url) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("\uD83D\uDCCB Requirements")
            .setStyle(ButtonStyle.Link)
            .setURL(campaign.requirements_url),
        );
      }

      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    await interaction.editReply(`\u2728 Found **${campaigns.length}** open campaign(s) \u2014 check them out above!`);
  },
};
