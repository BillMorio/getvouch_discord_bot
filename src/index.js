require("dotenv").config();

const { Client, GatewayIntentBits, Collection, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

// --- Discord Bot Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: { timeout: 30_000 },
});

client.on("error", (err) => console.error("Client error:", err.message));
client.on("shardError", (err) => console.error("WebSocket error:", err.message));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err.message));

// Load slash commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const campaignEntry = require("./events/campaignEntry");
const submissionActions = require("./events/submissionActions");

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      // Submission-card action buttons handled first
      const id = interaction.customId;
      if (
        id.startsWith("upload_proof_") ||
        id.startsWith("claim_payment_") ||
        id.startsWith("set_method_") ||
        id.startsWith("noop_")
      ) {
        if (id.startsWith("noop_")) {
          await interaction.deferUpdate().catch(() => {});
          return;
        }
        await submissionActions.handleButton(interaction);
        return;
      }
      await campaignEntry.handleButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("set_method_")) {
        await submissionActions.handleModalSubmit(interaction);
        return;
      }
      await campaignEntry.handleModalSubmit(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
  } catch (error) {
    console.error(`Interaction error (${interaction.commandName || interaction.customId}):`, error);
    const payload = {
      content: "Something went wrong. Try again or contact an admin.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

// --- HTTP server (health check only for now) ---
const app = express();
app.get("/health", (_req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
