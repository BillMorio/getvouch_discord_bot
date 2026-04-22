// Channel IDs per the client's server layout. Each command is gated to
// the channel(s) it makes sense in. Env-driven so the client can swap
// channels without a redeploy. Missing/unset vars = no gating for that
// channel (command still works everywhere until configured).
const CHANNELS = {
  liveCampaigns: process.env.CHANNEL_LIVE_CAMPAIGNS || "",
  newCampaigns: process.env.CHANNEL_NEW_CAMPAIGNS || "",
  verification: process.env.CHANNEL_VERIFICATION || "",
  mySettings: process.env.CHANNEL_MY_SETTINGS || "",
};

module.exports = { CHANNELS };
