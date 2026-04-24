const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { submitClip } = require("../api");
const { CHANNELS } = require("../config");

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

  const verifyChannelId = CHANNELS.verification;
  const verifyMention = verifyChannelId ? `<#${verifyChannelId}>` : "the verification channel";

  const embed = new EmbedBuilder()
    .setTitle("✅ Submission Received")
    .setColor(0x00c853)
    .setDescription(
      `Your entry for **campaign #${campaignId}** is in — we'll fetch your stats shortly.\n` +
        `🔗 ${postUrl}\n\n` +
        `**Next step**\n` +
        `Head to ${verifyMention} and run \`/mysubmissions\` to track progress, upload your proof video, and claim payment once verified.`
    )
    .setFooter({ text: `Submission #${result.submission_id} · ${clipperEmail}` })
    .setTimestamp();

  const components = [];
  if (interaction.guildId && verifyChannelId) {
    const channelUrl = `https://discord.com/channels/${interaction.guildId}/${verifyChannelId}`;
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("→ Go to verify-to-get-paid")
          .setStyle(ButtonStyle.Link)
          .setURL(channelUrl)
      )
    );
  }

  await interaction.editReply({ embeds: [embed], components });
  return true;
}

module.exports = { handleButton, handleModalSubmit };
