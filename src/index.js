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

// --- Express Server (for Vouch + Lumina webhooks) ---
const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.send("OK"));

// Simple "verification done" landing page clippers get redirected to
app.get("/verify/done", (req, res) => {
  res.send(`<!doctype html><html><head><title>Verified</title>
    <style>body{font-family:system-ui;background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center;padding:40px;background:#16213e;border-radius:12px;max-width:400px}</style>
    </head><body><div><h1>\u2705 Verification Complete</h1>
    <p>You can close this tab and return to Discord \u2014 your submission status will update shortly.</p>
    </div></body></html>`);
});

// Vouch webhook: POST /api/webhook/vouch
// Vouch sends `Authorization: PSK <webhook-secret>` header.
const { unpackMetadata } = require("./vouch");
const { patchVerification } = require("./api");

app.post("/api/webhook/vouch", async (req, res) => {
  const auth = req.headers.authorization;
  const expected = `PSK ${process.env.VOUCH_WEBHOOK_SECRET}`;
  if (auth !== expected) {
    console.warn("Rejected Vouch webhook: bad auth header");
    return res.status(401).send("Unauthorized");
  }

  const { requestId, metadata, outputs } = req.body;
  console.log("Vouch webhook received, requestId:", requestId);

  const { submissionId, discordUserId } = unpackMetadata(metadata || "");
  if (!submissionId) {
    console.warn("Vouch webhook missing submissionId in metadata");
    return res.status(400).send("Bad metadata");
  }

  // Push verification result back to Lumina
  try {
    await patchVerification(submissionId, {
      verification_status: "verified",
      verification_request_id: requestId,
      outputs,
    });
    console.log(`Patched Lumina submission ${submissionId} as verified.`);
  } catch (err) {
    console.error("Failed to PATCH Lumina:", err);
  }

  // DM the clipper confirming verification
  if (discordUserId) {
    try {
      const user = await client.users.fetch(discordUserId);
      const { EmbedBuilder } = require("discord.js");
      const embed = new EmbedBuilder()
        .setTitle("\u2705 Verification Complete")
        .setDescription(
          `Your submission \`${submissionId}\` is now **verified**.\n` +
            `Your stats and demographics have been recorded.`
        )
        .setColor(0x00c853)
        .setTimestamp();
      await user.send({ embeds: [embed] });
    } catch (err) {
      console.warn("Couldn't DM clipper after verification:", err.message);
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN);
