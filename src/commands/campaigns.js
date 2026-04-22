const { SlashCommandBuilder } = require("discord.js");
const { listCampaigns } = require("../api");
const { requireChannel } = require("../lib/guards");
const { CHANNELS } = require("../config");
const { buildCampaignCard } = require("../lib/campaignCard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("campaigns")
    .setDescription("Browse open campaigns"),

  async execute(interaction) {
    if (!(await requireChannel(interaction, CHANNELS.liveCampaigns))) return;
    await interaction.deferReply();

    let campaigns;
    try {
      campaigns = await listCampaigns();
    } catch (err) {
      console.error("listCampaigns error:", err);
      return interaction.editReply("Failed to load campaigns. Try again later.");
    }

    if (!campaigns.length) {
      return interaction.editReply("No open campaigns right now. Check back soon!");
    }

    for (const c of campaigns) {
      await interaction.channel.send(buildCampaignCard(c));
    }

    await interaction.editReply(`✨ Found **${campaigns.length}** open campaign(s) above.`);
  },
};
