const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { submitEntry } = require("../api");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bulk")
    .setDescription("Bulk submit links to a campaign via file upload")
    .addStringOption((opt) =>
      opt
        .setName("campaign_id")
        .setDescription("The campaign ID to submit to")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("file")
        .setDescription("CSV or TXT file with one URL per line")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const campaignId = interaction.options.getString("campaign_id");
    const clipperEmail = interaction.options.getString("email");
    const attachment = interaction.options.getAttachment("file");

    // Validate file type
    const allowedExts = [".csv", ".txt"];
    if (!allowedExts.some((e) => attachment.name.toLowerCase().endsWith(e))) {
      return interaction.editReply(
        `Unsupported file type. Please upload a \`.csv\` or \`.txt\` file.`
      );
    }

    // Size guard (1 MB)
    if (attachment.size > 1_000_000) {
      return interaction.editReply("File too large. Max 1 MB.");
    }

    // Download the file
    let text;
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      console.error("File download error:", err);
      return interaction.editReply("Failed to download your file. Try again.");
    }

    // Parse URLs — split on newlines and commas, trim, drop empties and non-URLs
    const urls = text
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^https?:\/\//i.test(s));

    if (urls.length === 0) {
      return interaction.editReply(
        "No valid URLs found in the file. Make sure each line has a link starting with `http://` or `https://`."
      );
    }

    // Cap at 50 to avoid abuse
    const MAX_URLS = 50;
    const toSubmit = urls.slice(0, MAX_URLS);
    const skipped = urls.length - toSubmit.length;

    // TODO: replace with POST /submissions/bulk when Lumina ships it
    const results = await Promise.all(
      toSubmit.map(async (url) => {
        try {
          const res = await submitEntry({
            campaign_id: campaignId,
            clipper_email: clipperEmail,
            post_url: url,
            discord_user_id: interaction.user.id,
          });
          return { url, ...res };
        } catch (err) {
          return { url, status: "error", detail: err.message };
        }
      })
    );

    const accepted = results.filter((r) => r.status === "ok");
    const rejected = results.filter((r) => r.status !== "ok");

    const embed = new EmbedBuilder()
      .setTitle(`Bulk Submission \u2014 ${toSubmit.length} link(s)`)
      .setColor(rejected.length === 0 ? 0x00c853 : accepted.length === 0 ? 0xf44336 : 0xffc107)
      .setDescription(
        `\u2705 **${accepted.length} accepted**\n\u274C **${rejected.length} rejected**` +
          (skipped > 0 ? `\n\u26A0\uFE0F ${skipped} skipped (max ${MAX_URLS} per upload)` : "")
      )
      .setTimestamp()
      .setFooter({ text: `Campaign #${campaignId}  \u2022  ${attachment.name}` });

    if (accepted.length > 0) {
      const acceptedList = accepted
        .map((r) => `\`#${r.submission_id}\` \u2014 ${truncate(r.url, 60)}`)
        .slice(0, 15)
        .join("\n");
      embed.addFields({ name: "Accepted", value: acceptedList });
    }

    if (rejected.length > 0) {
      const rejectedList = rejected
        .map((r) => `\u2022 ${truncate(r.url, 50)}\n   \u21B3 ${r.detail}`)
        .slice(0, 15)
        .join("\n");
      embed.addFields({ name: "Rejected", value: rejectedList });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "\u2026" : str;
}
