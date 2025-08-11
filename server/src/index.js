require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const Joi = require("joi");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || "change-me";
const ALLOW_NO_AUTH = String(process.env.ALLOW_NO_AUTH || "false") === "true";

// Warnung ausgeben wenn unsichere Standardeinstellungen verwendet werden
if (BROADCAST_SECRET === "change-me" || ALLOW_NO_AUTH) {
  console.warn("⚠️  WARNUNG: Unsichere Standardeinstellungen!");
  console.warn("   - BROADCAST_SECRET sollte geändert werden");
  console.warn("   - ALLOW_NO_AUTH sollte false sein für Produktion");
  console.warn("   - Erstelle eine .env Datei mit sicheren Werten");
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(morgan("combined"));

// Rate limiting for broadcast
const broadcastLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// WS server
const wss = new WebSocketServer({ noServer: true });

// Track clients
const clients = new Set();

server.on("upgrade", (request, socket, head) => {
  const { url } = request;
  if (!url || !url.startsWith("/ws")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws, request) => {
  // Attach basic metadata (display name from query)
  try {
    const parsed = new URL(request.url, "http://localhost");
    const name = (parsed.searchParams.get("name") || "Anonymous").slice(0, 32);
    const ip = request.socket.remoteAddress || "unknown";

    // Generiere eindeutige User-ID basierend auf Name + IP + Timestamp
    const uniqueId = `${name}-${ip}-${Date.now()}`;

    ws.user = {
      name,
      id: uniqueId,
      ip: ip,
      status: "online",
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
    };

    console.log(
      `🔌 WS connected: ${name} (${ip}) - Total clients: ${clients.size + 1}`
    );
  } catch (_) {
    ws.user = {
      name: "Anonymous",
      id: `Anonymous-${Date.now()}`,
      ip: "unknown",
      status: "online",
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
    };
  }

  // Simple per-connection rate limiter (max 5 events per 10s)
  const recent = [];
  function withinRateLimit() {
    const now = Date.now();
    while (recent.length && now - recent[0] > 10_000) recent.shift();
    if (recent.length >= 5) return false;
    recent.push(now);
    return true;
  }

  clients.add(ws);
  ws.on("message", (data) => {
    // Allow clients to send hamster/toast events upstream
    try {
      if (!withinRateLimit()) return;
      const parsed = JSON.parse(String(data));

      // Handle name updates separately (not validated by eventSchema)
      if (parsed.type === "update-name" && parsed.name) {
        if (ws.user) {
          ws.user.name = String(parsed.name).slice(0, 32);
          console.log(`📝 User updated name to: ${ws.user.name}`);
        }
        return;
      }

      const { error, value } = eventSchema.validate(parsed, {
        stripUnknown: true,
      });
      if (error) return;

      // Verwende die gleiche shouldDeliver Logik wie beim HTTP-Broadcast
      const outbound = {
        ...value,
        sender: ws.user?.name || "Anonymous", // Nur der "schöne" Name ohne IP
        senderId: ws.user?.id || ws.user?.name || "Anonymous",
      };

      // Empfänger-Info für Toast-Nachrichten hinzufügen
      if (value.type === "toast") {
        outbound.recipientInfo = getRecipientInfo(
          value.target,
          outbound.sender
        );
      }

      const payload = JSON.stringify(outbound);

      // Log für alle Toast-Nachrichten
      if (value.type === "toast") {
        console.log(
          `🍞 Toast: "${value.message}" from ${
            outbound.sender
          } to ${JSON.stringify(value.target || "all")}`
        );
        console.log(
          `📋 Available clients: ${Array.from(clients)
            .map((c) => c.user?.name || "Unknown")
            .join(", ")}`
        );
      }

      for (const c of clients) {
        if (c.readyState === c.OPEN && shouldDeliver(c, outbound)) {
          try {
            c.send(payload);
          } catch (_) {}
        }
      }
    } catch (_) {}
  });

  ws.on("close", () => {
    console.log(
      `🔌 WS disconnected: ${ws.user?.name || "Unknown"} (${
        ws.user?.ip || "unknown IP"
      })`
    );
    clients.delete(ws);
  });
});

// Helper function to extract clean display name from target (removes IP addresses)
function getCleanDisplayName(target) {
  if (!target || typeof target !== "string") return target;

  // Falls es eine UUID ist (Name-IP-Timestamp), extrahiere nur den Namen
  if (target.includes("-::ffff:")) {
    return target.split("-::ffff:")[0];
  }

  // Falls es ein displayName mit IP ist, extrahiere nur den Namen
  if (target.includes(" (::ffff:")) {
    return target.split(" (::ffff:")[0];
  }

  return target;
}

// Helper function to generate recipient info for toast messages
function getRecipientInfo(target, sender) {
  if (!target || (Array.isArray(target) && target.length === 0)) {
    return "an alle";
  }

  if (target === "all") {
    return "an alle";
  }

  if (target === "me") {
    return "an alle";
  }

  // Spezifische User(s) als Target
  const targets = Array.isArray(target) ? target : [target];
  if (targets.length === 1) {
    const cleanName = getCleanDisplayName(targets[0]);
    return `an ${cleanName}`;
  } else {
    const cleanNames = targets.map(getCleanDisplayName);
    return `an ${cleanNames.slice(0, -1).join(", ")} und ${
      cleanNames[cleanNames.length - 1]
    }`;
  }
}

// Global helper function for message delivery logic
function shouldDeliver(client, evt) {
  const clientName = client.user?.name || "";
  const clientId = client.user?.id || clientName;

  // Debug-Logging für alle Nachrichten
  if (evt.type === "toast") {
    console.log(
      `🔍 Checking delivery for client "${clientName}" (${clientId}): target="${JSON.stringify(
        evt.target || "all"
      )}" -> `
    );
  }

  // Kein Target = an alle senden
  if (!evt.target || (Array.isArray(evt.target) && evt.target.length === 0)) {
    if (evt.type === "toast") console.log(`✅ DELIVER (no target)`);
    return true;
  }

  // Target "all" = an alle senden
  if (evt.target === "all") {
    if (evt.type === "toast") console.log(`✅ DELIVER (target: all)`);
    return true;
  }

  // Target "me" = nur an den Sender
  if (evt.target === "me" && evt.sender) {
    const matches = clientName === evt.sender;
    if (evt.type === "toast")
      console.log(
        `✅ DELIVER (target: me) -> ${matches ? "MATCH" : "NO MATCH"}`
      );
    return matches;
  }

  // Spezifische User(s) als Target
  const targets = Array.isArray(evt.target) ? evt.target : [evt.target];

  const result = targets.some((target) => {
    const targetStr = String(target || "").toLowerCase();
    const clientDisplayName = `${clientName} (${client.user?.ip || "unknown"})`;

    const matches =
      targetStr === clientName.toLowerCase() ||
      targetStr === clientId.toLowerCase() ||
      targetStr === clientDisplayName.toLowerCase();

    if (evt.type === "toast") {
      console.log(
        `🔍 Target "${targetStr}" vs client "${clientName}" (displayName: "${clientDisplayName}") -> ${
          matches ? "✅ MATCH" : "❌ NO MATCH"
        }`
      );
    }

    return matches;
  });

  if (evt.type === "toast") {
    console.log(
      `📤 Final result for "${clientName}": ${result ? "SEND" : "BLOCK"}`
    );
  }

  return result;
}

// Validation schemas
const hamsterSchema = Joi.object({
  type: Joi.string().valid("hamster").required(),
  variant: Joi.string().min(1).max(64).default("default"),
  duration: Joi.number().integer().min(300).max(30000).default(3000),
  target: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  sender: Joi.string().min(1).max(64).optional(),
}).required();

const toastSchema = Joi.object({
  type: Joi.string().valid("toast").required(),
  message: Joi.string().min(1).max(280).required(),
  // entertainment palette + legacy values for compatibility
  severity: Joi.string()
    .valid(
      "red",
      "pink",
      "green",
      "blue",
      "info",
      "success",
      "warn",
      "critical"
    )
    .default("blue"),
  // Cap toast duration to 10s
  duration: Joi.number().integer().min(500).max(10000).default(4000),
  target: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  sender: Joi.string().min(1).max(64).optional(),
}).required();

const eventSchema = Joi.alternatives().try(hamsterSchema, toastSchema);

// Helpers
function isAuthorized(req) {
  const auth = req.header("authorization") || "";

  // Wenn ALLOW_NO_AUTH aktiviert ist, immer erlauben (nur für Entwicklung!)
  if (ALLOW_NO_AUTH) {
    console.warn(
      "⚠️  ALLOW_NO_AUTH ist aktiviert - Broadcast ohne Token erlaubt!"
    );
    return true;
  }

  // Prüfe Bearer Token
  if (!auth.startsWith("Bearer ")) {
    console.log("❌ Unauthorized: Kein Bearer Token");
    return false;
  }

  const token = auth.slice("Bearer ".length);
  const isValid = token === BROADCAST_SECRET;

  if (!isValid) {
    console.log("❌ Unauthorized: Ungültiger Token");
  }

  return isValid;
}

function logBroadcast(req, eventType) {
  try {
    const logLine = `${new Date().toISOString()}\t${req.ip}\t${eventType}\n`;
    const logPath = path.join(__dirname, "..", "broadcast.log");
    fs.appendFile(logPath, logLine, () => {});
  } catch (_) {}
}

// Routes
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Neue Endpoints für User-Management
app.get("/users", (req, res) => {
  const activeUsers = Array.from(clients)
    .filter((ws) => ws.readyState === ws.OPEN && ws.user?.name)
    .map((ws) => ({
      id: ws.user?.id || ws.user?.name,
      name: ws.user?.name,
      displayName: `${ws.user?.name} (${ws.user?.ip})`,
      status: ws.user?.status || "online",
      ip: ws.user?.ip || "unknown",
      lastSeen: ws.user?.lastSeen || new Date().toISOString(),
      connectedAt: ws.user?.connectedAt || new Date().toISOString(),
    }));

  res.json({
    users: activeUsers,
    count: activeUsers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/users/:userId", (req, res) => {
  const userId = req.params.userId;
  const user = Array.from(clients).find(
    (ws) =>
      ws.readyState === ws.OPEN &&
      (ws.user?.id === userId || ws.user?.name === userId)
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user.user?.id || user.user?.name,
    name: user.user?.name,
    status: user.user?.status || "online",
    lastSeen: user.user?.lastSeen || new Date().toISOString(),
  });
});

app.post("/broadcast", broadcastLimiter, async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { error, value } = eventSchema.validate(req.body, {
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // If sender provided in HTTP payload, keep it; else clients will attach their own sender on WS path
  // Broadcast with optional target filtering

  let sent = 0;

  // Empfänger-Info für Toast-Nachrichten hinzufügen
  const outbound = { ...value };
  if (value.type === "toast") {
    outbound.recipientInfo = getRecipientInfo(value.target, value.sender);
  }

  const payload = JSON.stringify(outbound);

  // Log für targeted messages
  if (value.target && value.target !== "all") {
    console.log(
      `🎯 Targeted message: ${value.type} to ${JSON.stringify(
        value.target
      )} from ${value.sender || "unknown"}`
    );
  }

  for (const ws of clients) {
    if (ws.readyState === ws.OPEN && shouldDeliver(ws, value)) {
      try {
        ws.send(payload);
        sent += 1;
      } catch (_) {}
    }
  }

  logBroadcast(req, value.type);
  res.json({ ok: true, sent });
});

server.listen(PORT, () => {
  console.log(`WS Hub listening on http://localhost:${PORT}`);
});
