const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { listUserSubmissions, listClipperSubmissions } = require("../api");
const { buildSubmissionCard } = require("../lib/submissionCard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mysubmissions")
    .setDescription("List your recent submissions with their current status")
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
    const status = interaction.options.getString("status") || undefined;

    // Resolve this Discord user's email via their bot-linked submissions.
    // This gates access — only someone who's submitted at least once through
    // the bot (and so proved their email) can see that email's full list.
    let idResult;
    try {
      idResult = await listUserSubmissions(interaction.user.id, { limit: 1 });
    } catch (err) {
      console.error("listUserSubmissions error:", err);
      return interaction.editReply("Couldn't load your submissions. Try again.");
    }

    const email = idResult.email || idResult.submissions?.[0]?.clipper_email;
    if (!email) {
      return interaction.editReply(
        "You haven't submitted anything via Discord yet. Enter a campaign through the bot once, then this will show all submissions linked to your email."
      );
    }

    // Email-keyed lookup returns everything on the clipper's account,
    // including submissions made via the web dashboard.
    let result;
    try {
      result = await listClipperSubmissions(email, { limit: 10, status });
    } catch (err) {
      console.error("listClipperSubmissions error:", err);
      return interaction.editReply("Couldn't load your submissions. Try again.");
    }

    const submissions = result.submissions || [];
    if (submissions.length === 0) {
      const msg = status
        ? `You have no submissions with status \`${status}\`.`
        : "You have no submissions yet. Enter a campaign to get started!";
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
