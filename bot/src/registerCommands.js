require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const GUILD_ID = process.env.GUILD_ID || "";

const commands = [
  new SlashCommandBuilder()
    .setName("hamster")
    .setDescription("Send a hamster overlay")
    .addStringOption((o) =>
      o.setName("variant").setDescription("Variant name").setRequired(false)
    )
    .addIntegerOption((o) =>
      o.setName("duration").setDescription("Duration ms").setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Target id (optional)")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("toast")
    .setDescription("Send a toast overlay")
    .addStringOption((o) =>
      o.setName("message").setDescription("Message text").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("severity")
        .setDescription("info|success|warn|critical")
        .setRequired(false)
    )
    .addIntegerOption((o) =>
      o.setName("duration").setDescription("Duration ms").setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Target id (optional)")
        .setRequired(false)
    ),
].map((c) => c.toJSON());

(async function run() {
  if (!DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN not set");
    process.exit(1);
  }
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), {
        body: commands,
      });
      console.log("Registered guild commands");
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log("Registered global commands");
    }
  } catch (e) {
    console.error("Failed to register commands", e);
    process.exit(1);
  }
})();
