const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { fetchSubmission } = require("../api");
const { createProofRequest, DATASOURCES } = require("../vouch");

const BOT_BASE_URL = process.env.BOT_PUBLIC_URL || "https://getvouch-discord-bot.onrender.com";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Start verification for a submission")
    .addStringOption((opt) =>
      opt.setName("submission_id").setDescription("Submission ID").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("handle")
        .setDescription("Your account handle on that platform (e.g. @yourname)")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const submissionId = interaction.options.getString("submission_id");
    const rawHandle = interaction.options.getString("handle");
    const handle = rawHandle.replace(/^@/, "").trim();

    // Fetch the submission to learn its platform
    let submission;
    try {
      submission = await fetchSubmission(submissionId);
    } catch (err) {
      console.error("Fetch submission error:", err);
      return interaction.editReply("Couldn't find that submission. Double-check the ID.");
    }

    const platform = submission.platform;
    if (!DATASOURCES[platform]) {
      return interaction.editReply(
        `Verification isn't configured for **${platform}** yet. Contact an admin.`
      );
    }

    let result;
    try {
      result = await createProofRequest({
        platform,
        handle,
        submissionId,
        discordUserId: interaction.user.id,
        webhookUrl: `${BOT_BASE_URL}/api/webhook/vouch`,
        redirectBackUrl: `${BOT_BASE_URL}/verify/done`,
      });
    } catch (err) {
      console.error("Vouch proof request error:", err);
      return interaction.editReply(
        "Couldn't create the verification link. Try again or contact an admin."
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("\uD83D\uDD10  Verify Your Submission")
      .setDescription(
        `Click the link below to verify your **${platform}** account \`@${handle}\`.\n\n` +
          `[\uD83D\uDC49 Open Verification](${result.verificationUrl})\n\n` +
          `*You'll be prompted to install the Vouch browser extension if you don't have it. ` +
          `Once verification completes, you'll get a confirmation DM here.*`
      )
      .setColor(0x7c3aed)
      .setFooter({ text: `Submission: ${submissionId}` })
      .setTimestamp();

    // Try DMing the user for privacy; fall back to ephemeral reply
    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.editReply("\u2705 I've DM'd you the verification link.");
    } catch {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
