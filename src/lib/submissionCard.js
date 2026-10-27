const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { CHANNELS } = require("../config");

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
 * Returns { label, style, customId?, url?, disabled? } or null if no button applies.
 * A `url` field signals a Link-style button (no customId); `customId` is used otherwise.
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
    if (sub.upload_url) {
      return { label: "📹 Upload Video Proof to Claim Payment", url: sub.upload_url };
    }
    return {
      label: "⚠️ Upload Unavailable — Contact Support",
      style: ButtonStyle.Secondary,
      customId: `noop_${id}`,
      disabled: true,
    };
  }
  // Any verification_status is fine once a proof video exists — admin verifies later.
  return { label: "💰 Claim Payment", style: ButtonStyle.Success, customId: `claim_payment_${id}` };
}

function buildSubmissionCard(sub) {
  const pIcon = platformIcon[sub.platform] || "🌐";

  // A submission can be rejected at verification while `status` still reads
  // "submitted"; the card must not headline "Submitted" over a rejection notice.
  const isRejected =
    sub.status === "rejected" || sub.verification_status === "rejected";

  const theme = isRejected
    ? statusTheme.rejected
    : statusTheme[sub.status] || { color: 0x9e9e9e, icon: "❔", label: sub.status || "Unknown" };

  const stats =
    (sub.views || 0) > 0
      ? `👁 \`${sub.views.toLocaleString()}\` views  •  ❤️ \`${(sub.likes || 0).toLocaleString()}\` likes  •  💬 \`${(sub.comments || 0).toLocaleString()}\` comments`
      : "🕒 Stats pending…";

  const earnings =
    (sub.est_earnings || 0) > 0
      ? `💵 Est: \`$${sub.est_earnings.toFixed(2)}\``
      : "";

  // Once we're spelling the rejection out in full below, the raw
  // "Verification: rejected" line is just noise.
  const verif =
    sub.verification_status && !isRejected
      ? `🔐 Verification: \`${sub.verification_status}\``
      : "";

  // A bare "Rejected" badge sent clippers straight to a support ticket asking
  // why, so state the reason in the card and point at the appeal route. The
  // reason is quoted verbatim — admins write them in caps ("INORGANIC
  // IMPRESSIONS", "BOTS") and that shorthand is what support recognises.
  const appealRoute = CHANNELS.supportTickets
    ? `<#${CHANNELS.supportTickets}>`
    : "a support ticket";
  const reject = isRejected
    ? "\n" +
      (sub.rejection_reason
        ? `❌ **Your video was rejected for "${sub.rejection_reason}"**`
        : `❌ **Your video was rejected.** No reason was recorded.`) +
      `\nYou can open ${appealRoute} if you think otherwise.`
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
    const button = new ButtonBuilder().setLabel(action.label);
    if (action.url) {
      button.setStyle(ButtonStyle.Link).setURL(action.url);
    } else {
      button.setStyle(action.style).setCustomId(action.customId);
      if (action.disabled) button.setDisabled(true);
    }
    components.push(new ActionRowBuilder().addComponents(button));
  }

  return { embeds: [embed], components };
}

module.exports = { buildSubmissionCard };
