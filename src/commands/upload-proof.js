const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { uploadVerification, getSubmissionStatus } = require("../api");

const ALLOWED_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-quicktime"];
const MAX_SIZE = 100 * 1024 * 1024;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload-proof")
    .setDescription("Upload a screen recording as proof for a submission")
    .addIntegerOption((opt) =>
      opt.setName("submission_id").setDescription("Submission ID").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    )
    .addAttachmentOption((opt) =>
      opt.setName("video").setDescription("mp4 / mov / webm, max 100 MB").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const submissionId = interaction.options.getInteger("submission_id");
    const email = interaction.options.getString("email").trim();
    const attachment = interaction.options.getAttachment("video");

    if (attachment.size > MAX_SIZE) {
      return interaction.editReply(
        `File too large (${Math.round(attachment.size / 1024 / 1024)} MB). Max is 100 MB.`
      );
    }

    const mime = attachment.contentType || "";
    if (!ALLOWED_MIMES.some((m) => mime.startsWith(m))) {
      return interaction.editReply(
        `Unsupported video type \`${mime}\`. Please upload mp4, mov, or webm.`
      );
    }

    // Only pass discord_user_id if the submission already has one that matches
    // this user — otherwise the API's defence-in-depth check will 403 on
    // web-originated submissions (which have a null discord_user_id).
    let passDiscordId = false;
    try {
      const sub = await getSubmissionStatus(submissionId);
      const subDiscordId = sub.discord_user_id ? String(sub.discord_user_id) : null;
      if (subDiscordId && subDiscordId !== interaction.user.id) {
        return interaction.editReply(
          "This submission is linked to a different Discord account and can't be uploaded from here."
        );
      }
      passDiscordId = subDiscordId === interaction.user.id;
    } catch (err) {
      console.error("getSubmissionStatus error:", err);
      return interaction.editReply("Couldn't load this submission. Check the ID and try again.");
    }

    let buffer;
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } catch (err) {
      console.error("Video download error:", err);
      return interaction.editReply("Couldn't fetch your video from Discord. Try again.");
    }

    let result;
    try {
      result = await uploadVerification(
        submissionId,
        email,
        buffer,
        attachment.name || "proof.mp4",
        mime,
        passDiscordId ? interaction.user.id : undefined
      );
    } catch (err) {
      console.error("uploadVerification error:", err);
      return interaction.editReply(`Upload failed: ${err.message.slice(0, 200)}`);
    }

    const embed = new EmbedBuilder()
      .setTitle("📹 Proof Uploaded")
      .setDescription(
        `${result.message || "Verification video uploaded successfully."}\n\n` +
          `Your submission is now pending review.`
      )
      .setColor(0x00c853)
      .setFooter({ text: `Submission #${submissionId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
