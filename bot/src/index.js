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
const HUB_OWNER_ID = process.env.HUB_OWNER_ID || null; // Optional owner binding for invite-mode

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
      o
        .setName("variant")
        .setDescription("hamster variant")
        .setRequired(false)
        .setAutocomplete(true)
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
  new SlashCommandBuilder()
    .setName("sound")
    .setDescription("Play a sound on clients")
    .addStringOption((o) =>
      o
        .setName("file")
        .setDescription("Sound file (autocomplete)")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("volume")
        .setDescription("Volume 0-100 (default 100)")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Target user(s) or 'all' or 'me'")
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

function makeHeaders(extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${HUB_SECRET}`,
    ...extra,
  };
  // Server requires owner binding when invite system is enabled
  if (HUB_OWNER_ID) headers["X-Client-User"] = String(HUB_OWNER_ID);
  return headers;
}

async function checkHub() {
  try {
    const h = await fetch(`${HUB_URL}/health`).then((r) => r.json());
    console.log("Hub health:", h);
  } catch (e) {
    console.warn("Hub health check failed:", e?.message || String(e));
  }
  try {
    const r = await fetch(`${HUB_URL}/auth-check`, { headers: makeHeaders() });
    const body = await r.text();
    console.log("Auth-check:", r.status, body);
    if (!r.ok) {
      console.warn(
        "Auth-check not OK. In invite mode you must use an issued token (via /invite) and set HUB_OWNER_ID to the token's owner."
      );
    }
  } catch (e) {
    console.warn("Auth-check request failed:", e?.message || String(e));
  }
}

client.on("interactionCreate", async (interaction) => {
  // Autocomplete support for hamster variant
  if (interaction.isAutocomplete()) {
    try {
      const { commandName } = interaction;
      if (commandName === "hamster") {
        const focused = interaction.options.getFocused(true);
        if (focused?.name === "variant") {
          const list = await getHamsterChoices(focused?.value || "");
          return interaction.respond(list);
        }
      } else if (commandName === "sound") {
        const focused = interaction.options.getFocused(true);
        if (focused?.name === "file") {
          const list = await getSoundChoices(focused?.value || "");
          return interaction.respond(list);
        }
      }
    } catch (e) {
      // Swallow autocomplete errors silently; Discord ignores failures here
      console.warn("Autocomplete error:", e?.message || e);
    }
    return;
  }

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
    } else if (interaction.commandName === "sound") {
      const fileRaw = interaction.options.getString("file");
      let volume = interaction.options.getInteger("volume");
      const target = interaction.options.getString("target") || "all";
      const sender = interaction.user?.username || undefined;
      if (typeof volume !== "number" || !Number.isFinite(volume)) volume = 100;
      const vol01 = Math.max(0, Math.min(100, volume)) / 100;
      if (!fileRaw) throw new Error("No sound selected");
      // Ensure absolute URL so Electron overlay can resolve it
      let fileUrl = String(fileRaw);
      try {
        if (!/^https?:\/\//i.test(fileUrl)) {
          fileUrl = new URL(fileUrl, HUB_URL).toString();
        }
      } catch (_) {}
      await sendBroadcast({ type: "sound", url: fileUrl, volume: vol01, target, sender });
      await interaction.reply({ content: `Sound sent (${volume}%) to ${target}`, ephemeral: true });
    }
  } catch (e) {
    console.error("Command failed", e);
    if (!interaction.replied) {
      const msg = formatErrorMessage(e);
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

async function sendBroadcast(body) {
  const res = await fetch(`${HUB_URL}/broadcast`, {
    method: "POST",
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Broadcast failed: ${res.status} ${txt}`);
  }
}

async function getActiveUsers() {
  try {
    const res = await fetch(`${HUB_URL}/users`, { headers: makeHeaders() });

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
    const res = await fetch(`${HUB_URL}/users/${encodeURIComponent(userName)}`, {
      headers: makeHeaders(),
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to get user info:", error);
    return null;
  }
}

function formatErrorMessage(e) {
  try {
    const raw = String(e?.message || e || "").slice(0, 500);
    // Common cases: connection refused, 401 Unauthorized, etc.
    if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(raw)) {
      return "❌ Hub nicht erreichbar. Prüfe HUB_URL/Port.";
    }
    if (/401|unauthorized/i.test(raw)) {
      return "❌ Unauthorized: Prüfe HUB_SECRET Token und ggf. HUB_OWNER_ID (Invite-Modus).";
    }
    if (/403|forbidden/i.test(raw)) {
      return "❌ Forbidden: Invite/Owner stimmt nicht. Token neu ausstellen?";
    }
    return `❌ Fehler: ${raw}`;
  } catch (_) {
    return "Failed to execute command";
  }
}

// Simple in-memory cache for hamsters
let hamCache = { at: 0, items: [] };
const HAM_TTL_MS = 60 * 1000;
async function fetchHamsters() {
  try {
    const now = Date.now();
    if (now - hamCache.at < HAM_TTL_MS && Array.isArray(hamCache.items)) {
      return hamCache.items;
    }
    const res = await fetch(`${HUB_URL}/api/hamsters`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.hamsters) ? data.hamsters : [];
    hamCache = { at: now, items };
    return items;
  } catch (_) {
    return [];
  }
}

async function getHamsterChoices(query) {
  const q = String(query || "").toLowerCase();
  const items = await fetchHamsters();
  const filtered = items
    .map((h) => ({ name: String(h.name || h.id || "").trim(), value: String(h.id || h.name || "").trim(), type: h.type }))
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q))
    .slice(0, 25);
  return filtered.map((h) => ({ name: h.name, value: h.value }));
}

// Simple in-memory cache for sounds
let soundCache = { at: 0, items: [] };
const SOUND_TTL_MS = 60 * 1000;
async function fetchSounds() {
  try {
    const now = Date.now();
    if (now - soundCache.at < SOUND_TTL_MS && Array.isArray(soundCache.items)) {
      return soundCache.items;
    }
    const res = await fetch(`${HUB_URL}/api/sounds`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.sounds) ? data.sounds : [];
    soundCache = { at: now, items };
    return items;
  } catch (_) {
    return [];
  }
}

async function getSoundChoices(query) {
  const q = String(query || "").toLowerCase();
  const items = await fetchSounds();
  const filtered = items
    .map((s) => ({ name: String(s.filename || s.url || "").trim(), value: String(s.url || "").trim() }))
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
    .slice(0, 25);
  return filtered;
}

(async function main() {
  await checkHub();
  await registerCommands();
  await client.login(DISCORD_TOKEN);
})();
