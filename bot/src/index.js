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

if (HUB_SECRET === "change-me") {
  console.warn("⚠️  WARNUNG: HUB_SECRET ist nicht gesetzt!");
  console.warn("   - Erstelle eine .env Datei mit dem korrekten HUB_SECRET");
  console.warn("   - Muss mit dem BROADCAST_SECRET vom Server übereinstimmen");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

const commands = [
  new SlashCommandBuilder()
    .setName("hamster")
    .setDescription("Send a hamster to everyone")
    .addStringOption((o) =>
      o.setName("variant").setDescription("hamster variant").setRequired(false)
    )
    .addIntegerOption((o) =>
      o.setName("duration").setDescription("Duration ms").setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Target user(s) or 'all' or 'me'")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("toast")
    .setDescription("Send a toast message")
    .addStringOption((o) =>
      o.setName("message").setDescription("Toast message").setRequired(true)
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
        .setDescription("Target user(s) or 'all' or 'me'")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("users")
    .setDescription("Get list of active users"),
  new SlashCommandBuilder()
    .setName("user")
    .setDescription("Get info about a specific user")
    .addStringOption((o) =>
      o.setName("name").setDescription("User name or ID").setRequired(true)
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
      const target = interaction.options.getString("target") || "all";
      const sender = interaction.user?.username || undefined;
      await sendBroadcast({
        type: "hamster",
        variant,
        duration,
        target,
        sender,
      });
      await interaction.reply({
        content: `Hamster sent (${variant}, ${duration}ms) to ${target}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "toast") {
      const message = interaction.options.getString("message");
      const severity = interaction.options.getString("severity") || "info";
      const duration = interaction.options.getInteger("duration") || 4000;
      const target = interaction.options.getString("target") || "all";
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
        content: `Toast sent (${severity}, ${duration}ms) to ${target}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "users") {
      const users = await getActiveUsers();
      if (users.length === 0) {
        await interaction.reply({
          content: "❌ Keine aktiven User gefunden",
          ephemeral: true,
        });
        return;
      }

      const userList = users.map((u) => `• ${u.name} (${u.status})`).join("\n");
      await interaction.reply({
        content: `👥 **Aktive User (${users.length}):**\n${userList}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "user") {
      const userName = interaction.options.getString("name");
      const user = await getUserInfo(userName);

      if (!user) {
        await interaction.reply({
          content: `❌ User '${userName}' nicht gefunden`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `👤 **${user.name}**\nStatus: ${
          user.status
        }\nLetztes gesehen: ${new Date(user.lastSeen).toLocaleString("de-DE")}`,
        ephemeral: true,
      });
    }
  } catch (e) {
    console.error("Command failed", e);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Failed to execute command",
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

async function getActiveUsers() {
  try {
    const res = await fetch(`${HUB_URL}/users`, {
      headers: {
        Authorization: `Bearer ${HUB_SECRET}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to get users: ${res.status}`);
    }

    const data = await res.json();
    return data.users || [];
  } catch (error) {
    console.error("Failed to get active users:", error);
    return [];
  }
}

async function getUserInfo(userName) {
  try {
    const res = await fetch(
      `${HUB_URL}/users/${encodeURIComponent(userName)}`,
      {
        headers: {
          Authorization: `Bearer ${HUB_SECRET}`,
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to get user info:", error);
    return null;
  }
}

(async function main() {
  await registerCommands();
  await client.login(DISCORD_TOKEN);
})();
