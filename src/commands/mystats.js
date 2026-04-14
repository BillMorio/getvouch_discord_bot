const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchClipperStats } = require("../api");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("View your clipper stats")
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const email = interaction.options.getString("email");

    try {
      const stats = await fetchClipperStats(email);

      const campaignList = (stats.campaigns || [])
        .map((c) => `\u2022 ${c.name} (${c.submissions} subs)`)
        .join("\n") || "None";

      const embed = new EmbedBuilder()
        .setTitle("Your Stats")
        .setColor(0x2196f3)
        .addFields(
          { name: "Submissions", value: `${stats.total_submissions}`, inline: true },
          { name: "Total Views", value: `${(stats.total_views || 0).toLocaleString()}`, inline: true },
          { name: "Total Likes", value: `${(stats.total_likes || 0).toLocaleString()}`, inline: true },
          { name: "Total Comments", value: `${(stats.total_comments || 0).toLocaleString()}`, inline: true },
          { name: "Earnings", value: `$${(stats.total_earnings || 0).toFixed(2)}`, inline: true },
          { name: "Platforms", value: stats.platforms.join(", ") || "None", inline: true },
          { name: "Campaigns", value: campaignList, inline: false }
        )
        .setFooter({ text: email })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Fetch stats error:", err);
      await interaction.editReply("No stats found for that email, or something went wrong.");
    }
  },
};
