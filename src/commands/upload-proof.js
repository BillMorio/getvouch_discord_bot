const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { uploadVerification } = require("../api");
const { lookupToken } = require("../state");

const ALLOWED_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-quicktime"];
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload-proof")
    .setDescription("Upload a screen recording as proof for a submission")
    .addIntegerOption((opt) =>
      opt.setName("submission_id").setDescription("Submission ID").setRequired(true)
    )
    .addAttachmentOption((opt) =>
      opt.setName("video").setDescription("mp4 / mov / webm, max 100 MB").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("token")
        .setDescription("Submission token (only if the bot doesn't remember it)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const submissionId = interaction.options.getInteger("submission_id");
    const attachment = interaction.options.getAttachment("video");
    const providedToken = interaction.options.getString("token");
    const token = providedToken || lookupToken(submissionId);

    if (!token) {
      return interaction.editReply(
        "I don't have a token for this submission (bot may have restarted). " +
          "Please re-run with `token:` option — you can find it in the submit response."
      );
    }

    if (attachment.size > MAX_SIZE) {
      return interaction.editReply(`File too large (${Math.round(attachment.size / 1024 / 1024)} MB). Max is 100 MB.`);
    }

    const mime = attachment.contentType || "";
    if (!ALLOWED_MIMES.some((m) => mime.startsWith(m))) {
      return interaction.editReply(
        `Unsupported video type \`${mime}\`. Please upload mp4, mov, or webm.`
      );
    }

    // Download the file from Discord's CDN then forward to Lumina
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
        token,
        buffer,
        attachment.name || "proof.mp4",
        mime
      );
    } catch (err) {
      console.error("uploadVerification error:", err);
      return interaction.editReply(
        `Upload failed: ${err.message.slice(0, 200)}`
      );
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
