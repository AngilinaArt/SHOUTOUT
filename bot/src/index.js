require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const GUILD_ID = process.env.GUILD_ID || "";
const HUB_URL = process.env.HUB_URL || "http://localhost:3001";
const HUB_SECRET = process.env.HUB_SECRET || "change-me";

if (!DISCORD_TOKEN) {
  console.warn("DISCORD_TOKEN not set. Bot will not start.");
  process.exit(0);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

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

async function registerCommands() {
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
  }
}

client.on("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "hamster") {
      const variant = interaction.options.getString("variant") || "default";
      const duration = interaction.options.getInteger("duration") || 3000;
      const target = interaction.options.getString("target") || undefined;
      const sender = interaction.user?.username || undefined;
      await sendBroadcast({ type: "hamster", variant, duration, target, sender });
      await interaction.reply({
        content: `Hamster sent (${variant}, ${duration}ms)`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "toast") {
      const message = interaction.options.getString("message");
      const severity = interaction.options.getString("severity") || "info";
      const duration = interaction.options.getInteger("duration") || 4000;
      const target = interaction.options.getString("target") || undefined;
      const sender = interaction.user?.username || undefined;
      await sendBroadcast({
        type: "toast",
        message,
        severity,
        duration,
        target,
        sender,
      });
      await interaction.reply({
        content: `Toast sent (${severity}, ${duration}ms)`,
        ephemeral: true,
      });
    }
  } catch (e) {
    console.error("Command failed", e);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Failed to send broadcast",
        ephemeral: true,
      });
    }
  }
});

async function sendBroadcast(body) {
  const res = await fetch(`${HUB_URL}/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HUB_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Broadcast failed: ${res.status} ${txt}`);
  }
}

(async function main() {
  await registerCommands();
  await client.login(DISCORD_TOKEN);
})();
