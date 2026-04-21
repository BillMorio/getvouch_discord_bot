const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { getSubmissionStatus } = require("../api");

const statusColor = {
  awaiting_stats: 0xffc107,
  submitted: 0xffc107,
  stats_verified: 0x00c853,
  payment_claimed: 0x2196f3,
  paid: 0x2196f3,
  rejected: 0xf44336,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submission")
    .setDescription("Check the status of a submission")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Submission ID").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getInteger("id");

    let sub;
    try {
      sub = await getSubmissionStatus(id);
    } catch (err) {
      console.error("getSubmissionStatus error:", err);
      return interaction.editReply("Submission not found, or something went wrong.");
    }

    const embed = new EmbedBuilder()
      .setTitle(`Submission #${sub.id}`)
      .setColor(statusColor[sub.status] || 0x9e9e9e)
      .addFields(
        { name: "Platform", value: sub.platform || "—", inline: true },
        { name: "Status", value: sub.status || "—", inline: true },
        { name: "Scrape", value: sub.scrape_status || "—", inline: true },
        { name: "Views", value: `${(sub.views || 0).toLocaleString()}`, inline: true },
        { name: "Likes", value: `${(sub.likes || 0).toLocaleString()}`, inline: true },
        { name: "Comments", value: `${(sub.comments || 0).toLocaleString()}`, inline: true },
        { name: "Est. Earnings", value: `$${(sub.est_earnings || 0).toFixed(2)}`, inline: true },
        { name: "Post URL", value: sub.post_url || "—" }
      )
      .setTimestamp(sub.created_at ? new Date(sub.created_at) : new Date());

    await interaction.editReply({ embeds: [embed] });
  },
};
