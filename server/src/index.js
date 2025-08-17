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
const winston = require("winston");
require("winston-daily-rotate-file");

// Winston Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console logging (only in development)
    ...(process.env.NODE_ENV === "development"
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          }),
        ]
      : []),
    // Daily rotate file for all logs
    new winston.transports.DailyRotateFile({
      filename: "logs/shoutout-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d", // Keep logs for 14 days
      zippedArchive: true,
    }),
    // Error-only file
    new winston.transports.DailyRotateFile({
      filename: "logs/shoutout-error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d", // Keep error logs for 30 days
    }),
  ],
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || "change-me";
const ALLOW_NO_AUTH = String(process.env.ALLOW_NO_AUTH || "false") === "true";

// Warnung ausgeben wenn unsichere Standardeinstellungen verwendet werden
if (BROADCAST_SECRET === "change-me" || ALLOW_NO_AUTH) {
  logger.warn("Security Warning", {
    event: "security_warning",
    message: "Unsafe default settings detected",
    broadcastSecret: BROADCAST_SECRET === "change-me" ? "default" : "custom",
    allowNoAuth: ALLOW_NO_AUTH,
  });

  // Minimal console warning (no sensitive data)
  console.warn("⚠️  Security: Check configuration");
}

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: true, // Allow all origins (including file:// protocol from Electron)
    credentials: true,
  })
);
app.use(express.json({ limit: "256kb" }));
// Custom logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("HTTP Request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress,
    });
  });
  next();
});

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

    logger.info("WebSocket Connected", {
      event: "connection",
      userName: name,
      totalClients: clients.size + 1,
      ip: ip,
    });
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

  // Close any existing connections from the same user (but NOT the current one)
  const existingConnections = Array.from(clients).filter(
    (client) => client.user?.name === ws.user.name && client !== ws
  );

  // Also check wss.clients for duplicates (but NOT the current one)
  const existingWssConnections = Array.from(wss.clients).filter(
    (client) => client.user?.name === ws.user.name && client !== ws
  );

  const allExistingConnections = [
    ...new Set([...existingConnections, ...existingWssConnections]),
  ];

  if (allExistingConnections.length > 0) {
    console.log(
      `🔄 Closing ${allExistingConnections.length} existing connections for user: ${ws.user.name}`
    );
    allExistingConnections.forEach((client) => {
      try {
        client.close(1000, "Replaced by new connection");
        // Also remove from clients Set
        clients.delete(client);
      } catch (e) {
        console.error("Error closing existing connection:", e);
      }
    });
  }

  clients.add(ws);

  // Benachrichtige alle anderen über den neuen User
  const onlineNotification = {
    type: "user-status",
    status: "online",
    user: ws.user.name,
    message: `${ws.user.name} ist online`,
    timestamp: new Date().toISOString(),
  };

  // Sende an alle anderen Clients (nicht an den User selbst)
  clients.forEach((client) => {
    if (client !== ws && client.readyState === client.OPEN) {
      try {
        client.send(JSON.stringify(onlineNotification));
      } catch (e) {
        console.error("Error sending online notification:", e);
      }
    }
  });
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

      // Handle reactions separately
      if (parsed.type === "reaction") {
        console.log(`💖 Reaction received:`, parsed);
        handleReaction(ws, parsed);
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

      // Log für alle Toast-Nachrichten (ohne Inhalt)
      if (value.type === "toast") {
        logger.info("Toast Message", {
          event: "toast_sent",
          sender: outbound.sender,
          target: value.target || "all",
          hasMessage: !!value.message,
          messageLength: value.message ? value.message.length : 0,
          availableClients: Array.from(clients).map(
            (c) => c.user?.name || "Unknown"
          ),
        });
      }

      // DEBUG: Count how many clients will receive this message
      let deliveryCount = 0;
      const deliveryTargets = [];
      
      for (const c of clients) {
        if (c.readyState === c.OPEN && shouldDeliver(c, outbound)) {
          deliveryCount++;
          deliveryTargets.push(c.user?.name || 'Unknown');
          try {
            c.send(payload);
          } catch (_) {}
        }
      }
      
      if (value.type === "toast") {
        console.log(`📤 Toast delivered to ${deliveryCount} clients: [${deliveryTargets.join(', ')}]`);
      }
    } catch (_) {}
  });

  ws.on("close", () => {
    console.log(
      `🔌 WS disconnected: ${ws.user?.name || "Unknown"} (${
        ws.user?.ip || "unknown IP"
      })`
    );

    // Benachrichtige alle anderen über den User der offline geht
    const offlineNotification = {
      type: "user-status",
      status: "offline",
      user: ws.user?.name || "Unknown",
      message: `${ws.user?.name || "Unknown"} ist offline`,
      timestamp: new Date().toISOString(),
    };

    // Sende an alle verbleibenden Clients
    clients.forEach((client) => {
      if (client !== ws && client.readyState === client.OPEN) {
        try {
          client.send(JSON.stringify(offlineNotification));
        } catch (e) {
          console.error("Error sending offline notification:", e);
        }
      }
    });

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
    return true;
  }

  // Target "all" = an alle senden
  if (evt.target === "all") {
    return true;
  }

  // Target "me" = nur an den Sender
  if (evt.target === "me" && evt.sender) {
    const matches = clientName === evt.sender;
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

    // Target matching logic (no logging for privacy)

    return matches;
  });

  // Final delivery result (no logging for privacy)

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

// Hamster Assets API
app.get("/api/hamsters", (req, res) => {
  try {
    const hamstersDir = path.join(__dirname, "..", "assets", "hamsters");

    if (!fs.existsSync(hamstersDir)) {
      return res.json({ hamsters: [], count: 0 });
    }

    const files = fs.readdirSync(hamstersDir);
    const hamsters = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".gif"].includes(ext);
      })
      .map((file) => {
        const name = path.parse(file).name;
        return {
          id: name,
          name: name,
          filename: file,
          url: `/api/hamsters/${name}/image`,
          type: path.extname(file).substring(1).toLowerCase(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(
      `🐹 Found ${hamsters.length} hamsters:`,
      hamsters.map((h) => h.name).join(", ")
    );

    res.json({
      hamsters: hamsters,
      count: hamsters.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error loading hamsters:", error);
    res.status(500).json({ error: "Failed to load hamsters" });
  }
});

app.get("/api/hamsters/:id", (req, res) => {
  try {
    const hamsterId = req.params.id;
    const hamstersDir = path.join(__dirname, "..", "assets", "hamsters");

    const files = fs.readdirSync(hamstersDir);
    const hamsterFile = files.find((file) => {
      const name = path.parse(file).name;
      return name === hamsterId;
    });

    if (!hamsterFile) {
      return res.status(404).json({ error: "Hamster not found" });
    }

    const name = path.parse(hamsterFile).name;
    const hamster = {
      id: name,
      name: name,
      filename: hamsterFile,
      url: `/api/hamsters/${name}/image`,
      type: path.extname(hamsterFile).substring(1).toLowerCase(),
    };

    res.json(hamster);
  } catch (error) {
    console.error("Error loading hamster:", error);
    res.status(500).json({ error: "Failed to load hamster" });
  }
});

app.get("/api/hamsters/:id/image", (req, res) => {
  try {
    const hamsterId = req.params.id;
    const hamstersDir = path.join(__dirname, "..", "assets", "hamsters");

    const files = fs.readdirSync(hamstersDir);
    const hamsterFile = files.find((file) => {
      const name = path.parse(file).name;
      return name === hamsterId;
    });

    if (!hamsterFile) {
      return res.status(404).json({ error: "Hamster image not found" });
    }

    const imagePath = path.join(hamstersDir, hamsterFile);
    const ext = path.extname(hamsterFile).toLowerCase();

    // Set appropriate content type
    const contentType =
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
      }[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    const stream = fs.createReadStream(imagePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Error serving hamster image:", error);
    res.status(500).json({ error: "Failed to serve hamster image" });
  }
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

// Funktion für Reaction-Handling
function handleReaction(senderWs, data) {
  const { targetUserId, reaction, fromUser } = data;

  if (!targetUserId || !reaction || !fromUser) {
    console.error(`❌ Invalid reaction data:`, data);
    return;
  }

  console.log(
    `💖 Processing reaction: ${reaction} from ${fromUser} to ${targetUserId}`
  );

  // Finde den Ziel-Client
  let targetClient = null;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.user) {
      if (
        client.user.id === targetUserId ||
        client.user.name === targetUserId ||
        client.user.displayName === targetUserId
      ) {
        targetClient = client;
      }
    }
  });

  if (!targetClient) {
    console.warn(`⚠️ Target user not found for reaction: ${targetUserId}`);
    return;
  }

  // Sende Reaction an den Ziel-Client
  const reactionPayload = {
    type: "reaction",
    fromUser: fromUser,
    reaction: reaction,
  };

  console.log(`📤 Sending reaction to target:`, reactionPayload);

  try {
    targetClient.send(JSON.stringify(reactionPayload));
    console.log(`✅ Reaction sent successfully to ${targetUserId}`);
  } catch (error) {
    console.error(`❌ Error sending reaction:`, error);
  }
}

server.listen(PORT, () => {
  logger.info("Server Started", {
    event: "startup",
    port: PORT,
    httpUrl: `http://localhost:${PORT}`,
    wsUrl: `ws://localhost:${PORT}/ws`,
    cors: "enabled",
    timestamp: new Date().toISOString(),
  });

  // Minimal console output (no sensitive data)
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📝 Logs: ./logs/shoutout-*.log`);
});
