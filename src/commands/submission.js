const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getSubmissionStatus } = require("../api");
const { buildSubmissionCard } = require("../lib/submissionCard");
const { requireChannel } = require("../lib/guards");
const { CHANNELS } = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submission")
    .setDescription("Check the status of a submission")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Submission ID").setRequired(true)
    ),

  async execute(interaction) {
    if (!(await requireChannel(interaction, CHANNELS.verification))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getInteger("id");

    let sub;
    try {
      sub = await getSubmissionStatus(id);
    } catch (err) {
      console.error("getSubmissionStatus error:", err);
      return interaction.editReply("Submission not found, or something went wrong.");
    }

    const card = buildSubmissionCard(sub);
    await interaction.editReply(card);
  },
};
