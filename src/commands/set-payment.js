const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { getPaymentMethod } = require("../api");
const { buildCredentialModal } = require("../events/submissionActions");

const METHOD_LABEL = { paypal: "PayPal", whop: "Whop", solana: "Solana" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-payment")
    .setDescription("Set or update your payment method")
    .addStringOption((opt) =>
      opt.setName("email").setDescription("Your clipper email").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("method")
        .setDescription("Skip straight to the credential input")
        .setRequired(false)
        .addChoices(
          { name: "PayPal", value: "paypal" },
          { name: "Whop", value: "whop" },
          { name: "Solana", value: "solana" }
        )
    ),

  async execute(interaction) {
    const email = interaction.options.getString("email").trim();
    const method = interaction.options.getString("method");

    if (method) {
      await interaction.showModal(
        buildCredentialModal(`set_method_only_modal_${method}_${email}`, method)
      );
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let info;
    try {
      info = await getPaymentMethod(email);
    } catch (err) {
      console.error("getPaymentMethod error:", err);
      return interaction.editReply(
        "Couldn't load your payment method. Check the email and try again."
      );
    }

    const current = info.has_method
      ? `**Current method:** ${METHOD_LABEL[info.method] || info.method}\n\`${info.details || "—"}\``
      : "You haven't set a payment method yet.";

    const embed = new EmbedBuilder()
      .setTitle("💳 Payment Method")
      .setColor(0x5865f2)
      .setDescription(
        `${current}\n\nPick one to ${info.has_method ? "switch to" : "set up"}:`
      )
      .setFooter({ text: email });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`set_method_only_paypal_${email}`)
        .setLabel("💰 PayPal")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set_method_only_whop_${email}`)
        .setLabel("🛒 Whop")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set_method_only_solana_${email}`)
        .setLabel("◎ Solana")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
