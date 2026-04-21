const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { submitClip, getSubmissionStatus } = require("../api");
const { rememberToken } = require("../state");
const { buildSubmissionCard } = require("../lib/submissionCard");

// "Enter Campaign" button → modal with URL + email
async function handleButton(interaction) {
  if (!interaction.customId.startsWith("enter_campaign_")) return false;

  const campaignId = interaction.customId.replace("enter_campaign_", "");

  const modal = new ModalBuilder()
    .setCustomId(`submit_entry_${campaignId}`)
    .setTitle("Enter Campaign");

  const urlInput = new TextInputBuilder()
    .setCustomId("post_url")
    .setLabel("Link to your content")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://www.instagram.com/reel/...")
    .setRequired(true);

  const emailInput = new TextInputBuilder()
    .setCustomId("clipper_email")
    .setLabel("Your email")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("you@example.com")
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(urlInput),
    new ActionRowBuilder().addComponents(emailInput)
  );

  await interaction.showModal(modal);
  return true;
}

// Modal submit → POST /api/discord/submit
async function handleModalSubmit(interaction) {
  if (!interaction.customId.startsWith("submit_entry_")) return false;

  const campaignId = parseInt(interaction.customId.replace("submit_entry_", ""), 10);
  const postUrl = interaction.fields.getTextInputValue("post_url").trim();
  const clipperEmail = interaction.fields.getTextInputValue("clipper_email").trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let result;
  try {
    result = await submitClip({
      campaign_id: campaignId,
      clipper_email: clipperEmail,
      post_url: postUrl,
      discord_user_id: interaction.user.id,
    });
  } catch (err) {
    console.error("submitClip error:", err);
    return interaction.editReply("Something went wrong submitting your entry. Try again later.");
  }

  if (result.status !== "ok") {
    return interaction.editReply(`❌ Submission failed: ${result.detail || "Unknown error"}`);
  }

  rememberToken(result.submission_id, result.submission_token);

  // Fetch full submission state so we can render the stateful card
  let submission;
  try {
    submission = await getSubmissionStatus(result.submission_id);
  } catch (err) {
    // Fallback: render a minimal card from what we have
    submission = {
      id: result.submission_id,
      post_url: postUrl,
      platform: result.platform || "unknown",
      status: "submitted",
      verification_status: "pending",
      has_video: false,
      clipper_email: clipperEmail,
      campaign_id: campaignId,
      created_at: new Date().toISOString(),
    };
  }

  const card = buildSubmissionCard(submission);
  await interaction.editReply(card);
  return true;
}

module.exports = { handleButton, handleModalSubmit };
