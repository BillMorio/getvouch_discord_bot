// Channel IDs per the client's server layout. Each command is gated to
// the channel(s) it makes sense in. Env-driven so the client can swap
// channels without a redeploy. Missing/unset vars = no gating for that
// channel (command still works everywhere until configured).
const CHANNELS = {
  liveCampaigns: process.env.CHANNEL_LIVE_CAMPAIGNS || "",
  newCampaigns: process.env.CHANNEL_NEW_CAMPAIGNS || "",
  verification: process.env.CHANNEL_VERIFICATION || "",
  mySettings: process.env.CHANNEL_MY_SETTINGS || "",
  // Where clippers appeal a rejection. Unset = the card says "a support ticket"
  // in plain text instead of linking the channel.
  supportTickets: process.env.CHANNEL_SUPPORT_TICKETS || "",
};

// Kill switch for wallet/payment-method changes through the bot.
// Defaults to BLOCKED: the /api/discord/* endpoints accept a free-text email
// with no proof of ownership, so any caller could redirect another clipper's
// payouts. Only set this to "true" once the API enforces that discord_user_id
// matches the clipper who owns the email.
const ALLOW_WALLET_CHANGES = process.env.ALLOW_BOT_WALLET_CHANGES === "true";

module.exports = { CHANNELS, ALLOW_WALLET_CHANGES };
