const { EmbedBuilder, MessageFlags } = require("discord.js");
const { getSubmissionStatus, uploadVerification } = require("./api");

const ALLOWED_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-quicktime"];
const MAX_SIZE = 100 * 1024 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;

// discord_user_id -> { submissionId, email, startedAt, timer }
const pending = new Map();

function cancelPending(userId) {
  const existing = pending.get(userId);
  if (existing?.timer) clearTimeout(existing.timer);
  pending.delete(userId);
}

function fallbackToSlashCommand(interaction, submissionId) {
  const embed = new EmbedBuilder()
    .setTitle("📹 Can't DM You")
    .setColor(0xff9800)
    .setDescription(
      `Your DMs with this bot are closed, so I can't ask for your video privately.\n\n` +
        `**Easy fix:** right-click the server name → **Privacy Settings** → enable *Direct Messages*, then click **Upload Video Proof** again.\n\n` +
        `**Or run this command instead:**\n` +
        `\`\`\`\n/upload-proof submission_id:${submissionId} email:<your email> video:<attach>\n\`\`\``
    )
    .setFooter({ text: `Submission #${submissionId}` });
  return interaction.editReply({ embeds: [embed] });
}

async function startDmUpload(interaction, submissionId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let sub;
  try {
    sub = await getSubmissionStatus(submissionId);
  } catch (err) {
    console.error("startDmUpload getSubmissionStatus error:", err);
    return interaction.editReply("Couldn't load this submission. Try again.");
  }

  const email = sub.clipper_email;
  if (!email) {
    return interaction.editReply("This submission has no email on file — can't proceed.");
  }

  // If the submission is already linked to a different Discord account, refuse.
  // If it's linked to THIS user, we'll pass the ID through for extra safety.
  // If it's unlinked (web-originated), skip the ID so the API check doesn't trip.
  const subDiscordId = sub.discord_user_id ? String(sub.discord_user_id) : null;
  if (subDiscordId && subDiscordId !== interaction.user.id) {
    return interaction.editReply(
      "This submission is linked to a different Discord account and can't be uploaded from here."
    );
  }
  const passDiscordId = subDiscordId === interaction.user.id;

  let dm;
  try {
    dm = await interaction.user.createDM();
    const embed = new EmbedBuilder()
      .setTitle("📹 Send Your Proof Video")
      .setColor(0x5865f2)
      .setDescription(
        `Reply here with your video attached — just tap the **+** / paperclip and send.\n\n` +
          `**Formats:** mp4 · mov · webm\n` +
          `**Max size:** 100 MB\n\n` +
          `I'll link it to **submission #${submissionId}** as soon as you send. This prompt expires in 10 minutes.`
      )
      .setFooter({ text: `Submission #${submissionId}` });
    await dm.send({ embeds: [embed] });
  } catch (err) {
    console.error("startDmUpload DM send failed:", err?.code, err?.message);
    return fallbackToSlashCommand(interaction, submissionId);
  }

  const userId = interaction.user.id;
  cancelPending(userId);

  const entry = {
    submissionId: String(submissionId),
    email,
    passDiscordId,
    startedAt: Date.now(),
  };
  entry.timer = setTimeout(() => {
    const current = pending.get(userId);
    if (current?.startedAt === entry.startedAt) pending.delete(userId);
  }, TIMEOUT_MS);
  pending.set(userId, entry);

  await interaction.editReply(
    `📬 **Check your DMs** — I just sent you a message there. Reply with your video attached and I'll handle the rest.`
  );
}

async function handleDmMessage(message) {
  if (message.author.bot) return;
  if (!message.channel.isDMBased()) return;

  const userId = message.author.id;
  const entry = pending.get(userId);
  if (!entry) return;

  const attachment = message.attachments.first();
  if (!attachment) {
    await message.reply(
      "I need a **video attachment**. Tap the **+** (or paperclip) next to the message box, pick your file, then send."
    );
    return;
  }

  if (attachment.size > MAX_SIZE) {
    await message.reply(
      `File too large (${Math.round(attachment.size / 1024 / 1024)} MB). Max is 100 MB.`
    );
    return;
  }

  const mime = attachment.contentType || "";
  if (!ALLOWED_MIMES.some((m) => mime.startsWith(m))) {
    await message.reply(
      `Unsupported video type \`${mime || "unknown"}\`. Please send mp4, mov, or webm.`
    );
    return;
  }

  const workingMsg = await message.reply("⏳ Uploading your proof...");

  let buffer;
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("DM video download error:", err);
    await workingMsg.edit("❌ Couldn't fetch your video from Discord. Try sending it again.").catch(() => {});
    return;
  }

  try {
    const result = await uploadVerification(
      entry.submissionId,
      entry.email,
      buffer,
      attachment.name || "proof.mp4",
      mime,
      entry.passDiscordId ? userId : undefined
    );

    const embed = new EmbedBuilder()
      .setTitle("✅ Proof Uploaded")
      .setColor(0x00c853)
      .setDescription(
        `${result.message || "Verification video uploaded successfully."}\n\n` +
          `Head back to the server and hit **💰 Claim Payment** on your submission card when you're ready.`
      )
      .setFooter({ text: `Submission #${entry.submissionId}` })
      .setTimestamp();

    await workingMsg.edit({ content: null, embeds: [embed] }).catch(() => {
      return message.reply({ embeds: [embed] });
    });

    cancelPending(userId);
  } catch (err) {
    console.error("DM uploadVerification error:", err);
    await workingMsg
      .edit(`❌ Upload failed: ${err.message.slice(0, 200)}`)
      .catch(() => message.reply(`❌ Upload failed: ${err.message.slice(0, 200)}`));
  }
}

module.exports = { startDmUpload, handleDmMessage };
