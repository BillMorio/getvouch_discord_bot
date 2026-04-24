require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// When DISCORD_GUILD_ID is set, register as guild commands for instant propagation.
// Without it, fall back to global commands (can take up to 1h to appear).
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;

const commands = [];
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    const scope = guildId ? `guild ${guildId} (instant)` : "globally (up to 1h to propagate)";
    console.log(`Registering ${commands.length} slash command(s) to ${scope}...`);
    await rest.put(route, { body: commands });
    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
})();
