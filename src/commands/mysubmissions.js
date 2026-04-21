const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { listClipperSubmissions } = require("../api");
const { buildSubmissionCard } = require("../lib/submissionCard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mysubmissions")
    .setDescription("List your submissions")
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("status")
        .setDescription("Filter by status")
        .setRequired(false)
        .addChoices(
          { name: "Submitted", value: "submitted" },
          { name: "Payment claimed", value: "payment_claimed" },
          { name: "Paid", value: "paid" },
          { name: "Rejected", value: "rejected" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const email = interaction.options.getString("email").trim();
    const status = interaction.options.getString("status") || undefined;

    let result;
    try {
      result = await listClipperSubmissions(email, { limit: 10, status });
    } catch (err) {
      console.error("listClipperSubmissions error:", err);
      return interaction.editReply("Couldn't load submissions. Check the email and try again.");
    }

    const submissions = result.submissions || [];
    if (submissions.length === 0) {
      const msg = status
        ? `No submissions with status \`${status}\` for that email.`
        : "No submissions found for that email.";
      return interaction.editReply(msg);
    }

    const total = result.total || submissions.length;
    const header = `📋 Showing ${submissions.length} of ${total} submission${total === 1 ? "" : "s"}:`;
    await interaction.editReply(header);

    for (const sub of submissions) {
      const card = buildSubmissionCard(sub);
      await interaction.followUp({ ...card, flags: MessageFlags.Ephemeral });
    }
  },
};
