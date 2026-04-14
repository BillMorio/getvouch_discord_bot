require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

// --- Discord Bot Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  rest: { timeout: 30_000 },
});

// Prevent crashes on network errors — discord.js auto-reconnects
client.on("error", (err) => console.error("Client error:", err.message));
client.on("shardError", (err) => console.error("WebSocket error:", err.message));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err.message));

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Load event handlers
const campaignEntry = require("./events/campaignEntry");

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  // Button clicks
  if (interaction.isButton()) {
    try {
      await campaignEntry.handleButton(interaction);
    } catch (error) {
      console.error("Button handler error:", error);
    }
    return;
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    try {
      await campaignEntry.handleModalSubmit(interaction);
    } catch (error) {
      console.error("Modal handler error:", error);
    }
    return;
  }

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const reply = {
        content: "Something went wrong running that command.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
});

client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

// --- Express Server (for Vouch webhooks) ---
const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.send("OK"));

// Webhook endpoint placeholder
app.post("/api/webhook", (req, res) => {
  console.log("Webhook received:", req.body);
  // TODO: validate PSK auth, process Vouch webhook
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN);
