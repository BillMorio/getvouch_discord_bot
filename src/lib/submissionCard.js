const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const platformIcon = {
  instagram: "📷",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "🐦",
};

const statusTheme = {
  submitted: { color: 0xffc107, icon: "⏳", label: "Submitted" },
  payment_claimed: { color: 0x2196f3, icon: "⏳", label: "Payment Pending" },
  paid: { color: 0x00c853, icon: "✅", label: "Paid" },
  rejected: { color: 0xf44336, icon: "❌", label: "Rejected" },
};

/**
 * Decide which single primary action button to show based on submission state.
 * Returns { label, style, customId, disabled } or null if no button applies.
 */
function pickPrimaryAction(sub) {
  const { id, status, verification_status: vStatus, has_video } = sub;

  if (status === "paid") {
    return { label: "✅ Paid", style: ButtonStyle.Secondary, customId: `noop_${id}`, disabled: true };
  }
  if (status === "rejected" || vStatus === "rejected") {
    return { label: "❌ Rejected", style: ButtonStyle.Secondary, customId: `noop_${id}`, disabled: true };
  }
  if (status === "payment_claimed") {
    return { label: "⏳ Payment Pending", style: ButtonStyle.Secondary, customId: `noop_${id}`, disabled: true };
  }
  if (!has_video) {
    return { label: "📹 Upload Video Proof to Claim Payment", style: ButtonStyle.Primary, customId: `upload_proof_${id}` };
  }
  // Any verification_status is fine once a proof video exists — admin verifies later.
  return { label: "💰 Claim Payment", style: ButtonStyle.Success, customId: `claim_payment_${id}` };
}

function buildSubmissionCard(sub) {
  const pIcon = platformIcon[sub.platform] || "🌐";
  const theme = statusTheme[sub.status] || { color: 0x9e9e9e, icon: "❔", label: sub.status || "Unknown" };

  const stats =
    (sub.views || 0) > 0
      ? `👁 \`${sub.views.toLocaleString()}\` views  •  ❤️ \`${(sub.likes || 0).toLocaleString()}\` likes  •  💬 \`${(sub.comments || 0).toLocaleString()}\` comments`
      : "🕒 Stats pending…";

  const earnings =
    (sub.est_earnings || 0) > 0
      ? `💵 Est: \`$${sub.est_earnings.toFixed(2)}\``
      : "";

  const verif = sub.verification_status
    ? `🔐 Verification: \`${sub.verification_status}\``
    : "";

  const reject = sub.rejection_reason
    ? `\n⚠️ **Reason:** ${sub.rejection_reason}`
    : "";

  const embed = new EmbedBuilder()
    .setTitle(`${pIcon}  Submission #${sub.id}`)
    .setDescription(
      `**Status:** ${theme.icon} ${theme.label}\n` +
        verif +
        reject +
        `\n──────────────────────────────\n` +
        `🔗 ${sub.post_url}\n\n` +
        stats +
        (earnings ? `\n${earnings}` : "")
    )
    .setColor(theme.color)
    .setFooter({ text: sub.clipper_email ? `Clipper: ${sub.clipper_email}` : `ID: ${sub.id}` })
    .setTimestamp(sub.created_at ? new Date(sub.created_at) : new Date());

  const action = pickPrimaryAction(sub);
  const components = [];
  if (action) {
    const button = new ButtonBuilder()
      .setCustomId(action.customId)
      .setLabel(action.label)
      .setStyle(action.style);
    if (action.disabled) button.setDisabled(true);
    components.push(new ActionRowBuilder().addComponents(button));
  }

  return { embeds: [embed], components };
}

module.exports = { buildSubmissionCard };
