const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  getSubmissionStatus,
  getPaymentMethod,
  setPaymentMethod,
  claimPayment,
} = require("../api");
const { buildSubmissionCard } = require("../lib/submissionCard");

// --- Button handlers -------------------------------------------------------

// upload_proof_<id>
async function handleUploadProofButton(interaction) {
  const submissionId = interaction.customId.replace("upload_proof_", "");

  const embed = new EmbedBuilder()
    .setTitle("📹 Upload Your Proof Video")
    .setColor(0x5865f2)
    .setDescription(
      `Almost there — one step to claim payment for **submission #${submissionId}**.\n\n` +
        `**Run this command with your video attached:**\n` +
        `\`\`\`\n/upload-proof submission_id:${submissionId} video:<attach>\n\`\`\``
    )
    .addFields(
      { name: "📦 Formats", value: "`mp4` · `mov` · `webm`", inline: true },
      { name: "📏 Max size", value: "100 MB", inline: true },
      {
        name: "🎬 What to record",
        value:
          "A screen recording showing your clip's analytics + geo breakdown on the platform.",
        inline: false,
      }
    )
    .setFooter({ text: `Submission #${submissionId}` });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

// claim_payment_<id>
async function handleClaimPaymentButton(interaction) {
  const submissionId = interaction.customId.replace("claim_payment_", "");
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Fetch fresh submission to get clipper_email
  let submission;
  try {
    submission = await getSubmissionStatus(submissionId);
  } catch (err) {
    return interaction.editReply("Couldn't fetch submission. Try again.");
  }

  const email = submission.clipper_email;
  if (!email) {
    return interaction.editReply("No email on file for this submission.");
  }

  // Check payment method
  let methodInfo;
  try {
    methodInfo = await getPaymentMethod(email);
  } catch (err) {
    return interaction.editReply("Couldn't check your payment method. Try again.");
  }

  if (!methodInfo.has_method) {
    // Prompt user to pick a payment method
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`set_method_paypal_${submissionId}`)
        .setLabel("💰 PayPal")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set_method_whop_${submissionId}`)
        .setLabel("🛒 Whop")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set_method_solana_${submissionId}`)
        .setLabel("◎ Solana")
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({
      content: "⚠️ You haven't set a payment method yet. Pick one below:",
      components: [row],
    });
  }

  // Has payment method — attempt claim
  return doClaim(interaction, submissionId, email);
}

// After payment method is set, retry claim. Shared helper.
async function doClaim(interaction, submissionId, email, editOriginal = false) {
  const { status, data } = await claimPayment(submissionId, email);

  if (status === 200 && data.ok) {
    // Refresh and render updated card
    let updated;
    try {
      updated = await getSubmissionStatus(submissionId);
    } catch {
      updated = null;
    }
    const embed = new EmbedBuilder()
      .setTitle("✅ Payment Claimed")
      .setDescription(
        `Submission #${submissionId} marked as \`${data.status}\`. ` +
          `You'll be paid via your chosen method once the admin processes the payout.`
      )
      .setColor(0x00c853)
      .setTimestamp();

    const reply = editOriginal ? interaction.editReply.bind(interaction) : interaction.editReply.bind(interaction);
    await reply({ embeds: [embed], components: [] });
    if (updated && interaction.message) {
      // Best-effort: also refresh the source card if possible
      try {
        const card = buildSubmissionCard(updated);
        await interaction.message.edit(card).catch(() => {});
      } catch {}
    }
    return;
  }

  // Error paths
  const detail = data.detail || "Unknown error";
  await interaction.editReply({
    content: `❌ Couldn't claim payment: ${detail}`,
    components: [],
  });
}

// set_method_<method>_<id>  — opens the credential modal
async function handleSetMethodButton(interaction) {
  const match = interaction.customId.match(/^set_method_(paypal|whop|solana)_(.+)$/);
  if (!match) return;
  const method = match[1];
  const submissionId = match[2];

  const fieldLabel = {
    paypal: "Your PayPal email",
    whop: "Your Whop username",
    solana: "Your Solana wallet address",
  }[method];

  const placeholder = {
    paypal: "you@example.com",
    whop: "@yourhandle",
    solana: "5xxxx...",
  }[method];

  const modal = new ModalBuilder()
    .setCustomId(`set_method_modal_${method}_${submissionId}`)
    .setTitle(`Set ${method.charAt(0).toUpperCase() + method.slice(1)}`);

  const input = new TextInputBuilder()
    .setCustomId("credential")
    .setLabel(fieldLabel)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// set_method_modal_<method>_<id>  — saves the method then retries claim
async function handleSetMethodModal(interaction) {
  const match = interaction.customId.match(/^set_method_modal_(paypal|whop|solana)_(.+)$/);
  if (!match) return;
  const method = match[1];
  const submissionId = match[2];
  const credential = interaction.fields.getTextInputValue("credential").trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Fetch submission to get email
  let submission;
  try {
    submission = await getSubmissionStatus(submissionId);
  } catch (err) {
    return interaction.editReply("Couldn't fetch submission.");
  }
  const email = submission.clipper_email;
  if (!email) return interaction.editReply("No email on file for this submission.");

  const body = {
    method,
    discord_user_id: interaction.user.id,
  };
  if (method === "paypal") body.paypal_email = credential;
  if (method === "whop") body.whop_username = credential;
  if (method === "solana") body.solana_address = credential;

  try {
    await setPaymentMethod(email, body);
  } catch (err) {
    console.error("setPaymentMethod error:", err);
    return interaction.editReply(`Couldn't save your ${method} info. ${err.message.slice(0, 150)}`);
  }

  // Now retry the claim
  return doClaim(interaction, submissionId, email);
}

// --- Dispatcher (called from index.js) ------------------------------------

async function handleButton(interaction) {
  const id = interaction.customId;
  if (id.startsWith("upload_proof_")) return handleUploadProofButton(interaction);
  if (id.startsWith("claim_payment_")) return handleClaimPaymentButton(interaction);
  if (id.startsWith("set_method_") && !id.startsWith("set_method_modal_"))
    return handleSetMethodButton(interaction);
  return false;
}

async function handleModalSubmit(interaction) {
  const id = interaction.customId;
  if (id.startsWith("set_method_modal_")) return handleSetMethodModal(interaction);
  return false;
}

module.exports = { handleButton, handleModalSubmit };
