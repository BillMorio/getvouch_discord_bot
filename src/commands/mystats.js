const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { getClipperStats } = require("../api");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("View your clipper stats")
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const email = interaction.options.getString("email").trim();

    let stats;
    try {
      stats = await getClipperStats(email);
    } catch (err) {
      console.error("getClipperStats error:", err);
      return interaction.editReply("No stats found for that email, or something went wrong.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📈 Your Stats")
      .setColor(0x2196f3)
      .addFields(
        { name: "Submissions", value: `${stats.total_submissions || 0}`, inline: true },
        { name: "Views", value: `${(stats.total_views || 0).toLocaleString()}`, inline: true },
        { name: "Likes", value: `${(stats.total_likes || 0).toLocaleString()}`, inline: true },
        { name: "Comments", value: `${(stats.total_comments || 0).toLocaleString()}`, inline: true },
        { name: "Earnings", value: `$${(stats.total_earnings || 0).toFixed(2)}`, inline: true },
        {
          name: "Platforms",
          value: (stats.platforms || []).join(", ") || "None",
          inline: true,
        },
        {
          name: "Campaigns",
          value: (stats.campaigns || []).map((c) => `#${c}`).join(", ") || "None",
        }
      )
      .setFooter({ text: email })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
