const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchSubmission } = require("../api");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submission")
    .setDescription("Check the status of a submission")
    .addStringOption((opt) =>
      opt.setName("id").setDescription("Submission ID").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const submissionId = interaction.options.getString("id");

    try {
      const sub = await fetchSubmission(submissionId);

      const statusColors = {
        awaiting_stats: 0xffc107,
        stats_verified: 0x00c853,
        paid: 0x2196f3,
        rejected: 0xf44336,
      };

      const embed = new EmbedBuilder()
        .setTitle(`Submission`)
        .setColor(statusColors[sub.status] || 0x9e9e9e)
        .addFields(
          { name: "Platform", value: sub.platform, inline: true },
          { name: "Status", value: sub.status, inline: true },
          { name: "Verification", value: sub.verification_status || "N/A", inline: true },
          { name: "Views", value: `${(sub.views || 0).toLocaleString()}`, inline: true },
          { name: "Likes", value: `${(sub.likes || 0).toLocaleString()}`, inline: true },
          { name: "Comments", value: `${(sub.comments || 0).toLocaleString()}`, inline: true },
          { name: "Est. Earnings", value: `$${(sub.est_earnings || 0).toFixed(2)}`, inline: true },
          { name: "Paid", value: `$${(sub.paid_earnings || 0).toFixed(2)}`, inline: true }
        )
        .addFields({ name: "Post URL", value: sub.post_url })
        .setFooter({ text: `ID: ${sub.submission_id}` })
        .setTimestamp(new Date(sub.created_at));

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Fetch submission error:", err);
      await interaction.editReply("Submission not found, or something went wrong.");
    }
  },
};
