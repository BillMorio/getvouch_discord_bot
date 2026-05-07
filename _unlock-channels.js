// Reverts the Send Messages denial we set in _lock-channels.js, in case the
// disabled input field also blocks slash commands. Sets SendMessages back to
// neutral (inherits from category/role default).
//
// Usage: node _unlock-channels.js

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const CHANNELS = [
  "1496887199596150854", // enter-campaigns
  "1496887486885007431", // verify-to-get-paid
  "1496887691391012865", // personal-settings
  "1498645411806838877", // platform-tutorial
];

const ROLES = ["@everyone", "Clipper"];

(async () => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise((resolve) => client.once("ready", resolve));
  console.log(`Logged in as ${client.user.tag}`);

  for (const channelId of CHANNELS) {
    let channel;
    try {
      channel = await client.channels.fetch(channelId);
    } catch (err) {
      console.error(`Could not fetch ${channelId}: ${err.message}`);
      continue;
    }
    if (!channel) continue;

    console.log(`\n#${channel.name}:`);
    const guild = channel.guild;

    for (const roleName of ROLES) {
      const role =
        roleName === "@everyone"
          ? guild.roles.everyone
          : guild.roles.cache.find((r) => r.name === roleName);
      if (!role) continue;
      try {
        await channel.permissionOverwrites.edit(role, { SendMessages: null });
        console.log(`  ✅ ${roleName}: SendMessages reset to neutral`);
      } catch (err) {
        console.error(`  ❌ ${roleName}: ${err.message}`);
      }
    }
  }

  console.log("\nDone.");
  await client.destroy();
  process.exit(0);
})();
