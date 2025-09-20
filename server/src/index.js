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
const { WebSocketServer, WebSocket } = require("ws");
const winston = require("winston");
require("winston-daily-rotate-file");
const { spawn } = require("child_process");

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
// Hinter Proxy (Caddy) echte Client-IP aus X-Forwarded-For nutzen
try { app.set("trust proxy", true); } catch (_) {}

const PORT = Number(process.env.PORT || 3001);
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || "change-me";
const WS_TOKEN = process.env.WS_TOKEN || null; // Optional separate WS token (legacy)
const ADMIN_SECRET = process.env.ADMIN_SECRET || null; // Admin API secret for token management
const INVITE_CODES = String(process.env.INVITE_CODES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_NO_AUTH = String(process.env.ALLOW_NO_AUTH || "false") === "true";
const TRANSLATOR_ENABLED = String(process.env.TRANSLATOR_ENABLED || "false") === "true";
const TRANSLATOR_PROVIDER = String(process.env.TRANSLATOR_PROVIDER || "none");
const TRANSLATOR_SCRIPT = process.env.TRANSLATOR_PY || path.join(__dirname, "translate", "ct2_translator.py");
// Prefer the project venv Python to ensure required packages are available
const VENV_PY = path.join(__dirname, "..", ".venv", "bin", "python3");
const PYTHON_BIN = fs.existsSync(VENV_PY) ? VENV_PY : "python3";

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
// Configure Helmet to allow cross-origin loading of static resources (e.g., images)
app.use(
  helmet({
    // We set a custom CSP for the admin route; disable global CSP to avoid conflicts
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
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

// Rate limiting for users listing
const usersLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for translate (heavy) – keyed by token if available, else IP
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    try {
      const auth = String(req.header("authorization") || "");
      if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
    } catch (_) {}
    return req.ip;
  },
});

// WS server
const wss = new WebSocketServer({ noServer: true });

// Track clients
const clients = new Set();

// Simple token store (JSON file persisted) for issued invite tokens
const configDir = path.join(__dirname, "..", "config");
const tokensPath = path.join(configDir, "tokens.json");
let issuedTokens = new Set();
let issuedTokenMeta = new Map(); // token -> { createdAt, ownerId?, deviceId?, lastUsedAt? }

function loadIssuedTokens() {
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (fs.existsSync(tokensPath)) {
      const raw = fs.readFileSync(tokensPath, "utf-8");
      const arr = JSON.parse(raw || "[]");
      if (Array.isArray(arr)) {
        if (arr.length && typeof arr[0] === "object" && arr[0] !== null) {
          const tokens = [];
          for (const it of arr) {
            if (!it || typeof it.token !== "string") continue;
            tokens.push(it.token);
            issuedTokenMeta.set(it.token, {
              createdAt: String(it.createdAt || new Date().toISOString()),
              ownerId: it.ownerId || null,
              deviceId: it.deviceId || null,
              lastUsedAt: it.lastUsedAt || null,
            });
          }
          issuedTokens = new Set(tokens);
        } else {
          // legacy: array of strings
          issuedTokens = new Set(arr.filter((t) => typeof t === "string"));
          // initialize meta and upgrade file format
          for (const t of issuedTokens) {
            issuedTokenMeta.set(t, { createdAt: new Date().toISOString(), ownerId: null, deviceId: null, lastUsedAt: null });
          }
          try { persistIssuedTokens(); } catch (_) {}
        }
      }
    }
  } catch (_) {
    issuedTokens = new Set();
    issuedTokenMeta = new Map();
  }
}

function persistIssuedTokens() {
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const out = Array.from(issuedTokens).map((t) => ({
      token: t,
      createdAt: issuedTokenMeta.get(t)?.createdAt || new Date().toISOString(),
      ownerId: issuedTokenMeta.get(t)?.ownerId || null,
      deviceId: issuedTokenMeta.get(t)?.deviceId || null,
      lastUsedAt: issuedTokenMeta.get(t)?.lastUsedAt || null,
    }));
    fs.writeFileSync(tokensPath, JSON.stringify(out, null, 2));
  } catch (_) {}
}

function generateToken() {
  try {
    return require("crypto").randomUUID();
  } catch (_) {
    return require("crypto").randomBytes(24).toString("hex");
  }
}

function hasInviteSystemEnabled() {
  // Invite system is considered enabled if any invite code is configured
  // or if there are already issued tokens present.
  return INVITE_CODES.length > 0 || issuedTokens.size > 0;
}

function isTokenValid(token) {
  if (!token) return false;
  // If invite system enabled, only accept issued tokens
  if (hasInviteSystemEnabled()) return issuedTokens.has(token);
  // Fallback to legacy single-secret when no invite system configured
  return token === BROADCAST_SECRET || (!!WS_TOKEN && token === WS_TOKEN);
}

function isTokenOwnerValid(token, ownerId) {
  if (!hasInviteSystemEnabled()) return true;
  const meta = issuedTokenMeta.get(token);
  if (!meta || !meta.ownerId) return false;
  return String(meta.ownerId) === String(ownerId || "");
}

function getTokenMeta(token) {
  try { return issuedTokenMeta.get(token) || null; } catch (_) { return null; }
}

// Load tokens at startup
loadIssuedTokens();

server.on("upgrade", (request, socket, head) => {
  try {
    const { url } = request;
    if (!url || !url.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    // Enforce token for WS connections unless ALLOW_NO_AUTH
    const parsed = new URL(url, "http://localhost");
    // Prefer Authorization header if present (Bearer <token>), else ?token=...
    const authHeader = String(request.headers["authorization"] || "");
    let token = null;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice("bearer ".length).trim();
    } else {
      token = parsed.searchParams.get("token");
    }
    const expected = WS_TOKEN || BROADCAST_SECRET; // legacy fallback

    if (!ALLOW_NO_AUTH) {
      const ok = isTokenValid(token);
      if (!ok) {
        try {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        } catch (_) {}
        socket.destroy();
        return;
      }
      if (hasInviteSystemEnabled()) {
        const ownerHeader = String(request.headers["x-client-user"] || "").trim();
        const meta = getTokenMeta(token);
        const ownOk = isTokenOwnerValid(token, ownerHeader);
        if (!ownOk) {
          try {
            console.warn("WS owner check failed", {
              event: "ws_owner_mismatch",
              tokenPrefix: token ? String(token).slice(0, 8) : null,
              headerOwnerPrefix: ownerHeader ? ownerHeader.slice(0, 8) : null,
              storedOwnerPrefix: meta?.ownerId ? String(meta.ownerId).slice(0, 8) : null,
            });
          } catch (_) {}
          try { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); } catch (_) {}
          socket.destroy();
          return;
        }
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } catch (_) {
    socket.destroy();
  }
});

wss.on("connection", (ws, request) => {
  // Attach basic metadata (display name from query)
  try {
    const parsed = new URL(request.url, "http://localhost");
    const name = (parsed.searchParams.get("name") || "Anonymous").slice(0, 32);
    const ip = request.socket.remoteAddress || "unknown";
    const authHeader = String(request.headers["authorization"] || "");
    let connToken = null;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      connToken = authHeader.slice("bearer ".length).trim();
    } else {
      connToken = parsed.searchParams.get("token");
    }

    // Generiere eindeutige User-ID basierend auf Name + IP + Timestamp
    const uniqueId = `${name}-${ip}-${Date.now()}`;
    const ownerHeader = String(request.headers["x-client-user"] || "").trim();
    const deviceHeader = String(request.headers["x-client-device"] || "").trim();

    ws.user = {
      name,
      id: uniqueId,
      ip: ip,
      status: "online",
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
      token: connToken || undefined,
      ownerId: ownerHeader || undefined,
      deviceId: deviceHeader || undefined,
    };

    logger.info("WebSocket Connected", {
      event: "connection",
      userName: name,
      totalClients: clients.size + 1,
      ip: ip,
      tokenPrefix: connToken ? String(connToken).slice(0, 8) : undefined,
      ownerPrefix: ownerHeader ? String(ownerHeader).slice(0, 8) : undefined,
      devicePrefix: deviceHeader ? String(deviceHeader).slice(0, 8) : undefined,
    });
    try {
      if (connToken && issuedTokens.has(connToken)) {
        const meta = issuedTokenMeta.get(connToken) || {};
        meta.lastUsedAt = new Date().toISOString();
        issuedTokenMeta.set(connToken, meta);
        persistIssuedTokens();
      }
    } catch (_) {}
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
  // Spoiler flag: if true, message renders hidden until revealed client-side
  spoiler: Joi.boolean().default(false),
  target: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  sender: Joi.string().min(1).max(64).optional(),
}).required();

const eventSchema = Joi.alternatives().try(hamsterSchema, toastSchema);

// Helpers

// Very lightweight language detection (DE vs EN) without deps
function detectLang(text) {
  try {
    const sample = String(text || "").slice(0, 2000);
    const lower = sample.toLowerCase();
    // Word-boundary based hints (more robust for short inputs like "Hallo Welt")
    const deWordRe = /(\b(hallo|und|nicht|danke|bitte|mit|ich|meine|mein|der|die|das|den|dem|zum|zur|für|weil|oder|aber|wird)\b)/g;
    const enWordRe = /(\b(hello|the|and|not|thanks|please|with|i|you|we|is|are|to|of|in|on|for)\b)/g;
    let deScore = 0;
    let enScore = 0;
    if (/[äöüß]/.test(lower)) deScore += 3; // strong German signal
    // Count matches
    const deMatches = lower.match(deWordRe);
    const enMatches = lower.match(enWordRe);
    if (deMatches) deScore += Math.min(3, deMatches.length);
    if (enMatches) enScore += Math.min(3, enMatches.length);
    // Specific start-of-text hints
    if (/^hallo\b/.test(lower)) deScore += 2;
    if (/^hello\b/.test(lower)) enScore += 2;
    if (deScore > enScore) return "de";
    if (enScore > deScore) return "en";
    // Fallback: majority of ASCII words
    return /[äöüß]/.test(lower) ? "de" : "en";
  } catch (_) {
    return "en";
  }
}

function detectFormat(text) {
  const t = String(text || "");
  const hasHeaders = /^(subject|betreff|from|to|cc|bcc)\s*:/im.test(t);
  const hasQuoted = /^>\s/m.test(t);
  const hasOriginalMarker = /original message|ursprüngliche nachricht/i.test(t);
  return hasHeaders || hasQuoted || hasOriginalMarker ? "email" : "plain";
}

function splitEmail(text) {
  const lines = String(text || "").split(/\r?\n/);
  const headers = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim();
      headers[key] = val;
      continue;
    }
    // blank line ends headers
    if (lines[i].trim() === "") {
      i += 1;
      break;
    }
    // no header-like anymore
    break;
  }
  const body = lines.slice(i).join("\n");
  return { headers, body };
}

function mapHeaderKey(key, langFrom, langTo) {
  const mapDeToEn = {
    Betreff: "Subject",
    Von: "From",
    An: "To",
    Kopie: "Cc",
    Blindkopie: "Bcc",
    Datum: "Date",
  };
  const mapEnToDe = {
    Subject: "Betreff",
    From: "Von",
    To: "An",
    Cc: "Kopie",
    Bcc: "Blindkopie",
    Date: "Datum",
  };
  if (langFrom === "de" && langTo === "en") return mapDeToEn[key] || key;
  if (langFrom === "en" && langTo === "de") return mapEnToDe[key] || key;
  return key;
}

async function runProviderTranslate(text, from, to) {
  if (!TRANSLATOR_ENABLED || TRANSLATOR_PROVIDER === "none") {
    return { ok: false, reason: "translator_disabled", translated: text };
  }
  if (TRANSLATOR_PROVIDER === "ct2") {
    return new Promise((resolve) => {
      try {
        const proc = spawn(PYTHON_BIN, [TRANSLATOR_SCRIPT, "--from", from, "--to", to], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: path.join(__dirname, ".."),
          env: process.env,
        });
        let out = "";
        let err = "";
        proc.stdout.on("data", (d) => (out += d.toString()));
        proc.stderr.on("data", (d) => (err += d.toString()));
        // Hard timeout to avoid runaway jobs
        const maxMs = 15000; // 15s cap
        const timer = setTimeout(() => {
          try { proc.kill("SIGKILL"); } catch (_) {}
          return resolve({ ok: false, reason: "timeout", translated: text });
        }, maxMs);
        proc.on("close", () => {
          try { clearTimeout(timer); } catch (_) {}
          try {
            const parsed = JSON.parse(out || "{}");
            if (parsed && parsed.translated) {
              try {
                const meta = parsed.meta || {};
                console.log("[translator] from=%s to=%s provider=%s reason=%s", from, to, meta.provider || "n/a", meta.reason || "");
              } catch (_) {}
              resolve({ ok: true, translated: parsed.translated, meta: parsed.meta });
            } else {
              resolve({ ok: false, reason: err || "no_output", translated: text });
            }
          } catch (_) {
            resolve({ ok: false, reason: "invalid_json", translated: text });
          }
        });
        proc.on("error", () => resolve({ ok: false, reason: "spawn_error", translated: text }));
        proc.stdin.write(text);
        proc.stdin.end();
      } catch (e) {
        resolve({ ok: false, reason: e.message || "exception", translated: text });
      }
    });
  }
  // Unknown provider
  return { ok: false, reason: "unknown_provider", translated: text };
}

async function translatePipeline({ text, direction = "auto", formatMode = "auto" }) {
  const detectedFormat = formatMode === "auto" ? detectFormat(text) : formatMode;
  let from = detectLang(text);
  let to = from === "de" ? "en" : "de";
  if (direction === "de-en") {
    from = "de";
    to = "en";
  } else if (direction === "en-de") {
    from = "en";
    to = "de";
  }

  if (detectedFormat === "email") {
    const { headers, body } = splitEmail(text);
    const headerLines = Object.entries(headers).map(([k, v]) => {
      const mapped = mapHeaderKey(k, from, to);
      // Do not translate email addresses/dates
      return `${mapped}: ${v}`;
    });
    // Preserve quoted lines; translate non-quoted paragraphs
    const bodyLines = body.split(/\r?\n/);
    const chunks = [];
    let buffer = [];
    function flushBuffer(arr) {
      if (arr.length) {
        chunks.push({ type: "text", value: arr.join("\n") });
        arr.length = 0;
      }
    }
    for (const line of bodyLines) {
      if (/^>\s?/.test(line)) {
        flushBuffer(buffer);
        chunks.push({ type: "quote", value: line });
      } else if (/^--\s?$/.test(line)) {
        flushBuffer(buffer);
        chunks.push({ type: "sep", value: line });
      } else {
        buffer.push(line);
      }
    }
    flushBuffer(buffer);

    // Translate only text chunks
    const outParts = [];
    outParts.push(headerLines.join("\n"));
    outParts.push("");
    for (const c of chunks) {
      if (c.type === "text") {
        // run provider per block
        // Note: synchronous serial translation to keep it simple
        // eslint-disable-next-line no-await-in-loop
        const res = await runProviderTranslate(c.value, from, to);
        outParts.push(res.translated);
      } else {
        outParts.push(c.value);
      }
    }
    return {
      ok: true,
      from,
      to,
      format: "email",
      translated: outParts.join("\n"),
    };
  }

  // Plain text: single shot
  const res = await runProviderTranslate(text, from, to);
  return {
    ok: !!res.ok,
    from,
    to,
    format: "plain",
    translated: res.translated,
    meta: res.meta || (res.reason ? { reason: res.reason } : undefined),
  };
}
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

  const token = auth.slice("Bearer ".length).trim();
  const isValid = isTokenValid(token);

  if (!isValid) {
    console.log("❌ Unauthorized: Ungültiger Token");
  }

  if (!isValid) return false;
  if (hasInviteSystemEnabled()) {
    const ownerHeader = String(req.header("x-client-user") || "").trim();
    const ownOk = isTokenOwnerValid(token, ownerHeader);
    if (!ownOk) {
      console.log("❌ Unauthorized: Owner mismatch for token");
      return false;
    }
  }
  return true;
}

// Read-only authorization: require a valid Bearer token but do not enforce owner binding
function isAuthorizedRead(req) {
  // Allow all if explicitly configured for development
  if (ALLOW_NO_AUTH) return true;
  const auth = String(req.header("authorization") || "");
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  return isTokenValid(token);
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

// Simple auth check for client tokens (no side effects)
app.get("/auth-check", (req, res) => {
  try {
    const auth = String(req.header("authorization") || "");
    let token = null;
    if (auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice("bearer ".length).trim();
    }
    if (!ALLOW_NO_AUTH) {
      if (!isTokenValid(token)) return res.status(401).json({ ok: false });
      if (hasInviteSystemEnabled()) {
        const ownerHeader = String(req.header("x-client-user") || "").trim();
        if (!isTokenOwnerValid(token, ownerHeader)) return res.status(401).json({ ok: false });
      }
    }
    return res.json({ ok: true });
  } catch (_) {
    return res.status(500).json({ ok: false });
  }
});

// Admin auth helper
function isAdminAuthorized(req) {
  try {
    const auth = String(req.header("authorization") || "");
    if (!auth.startsWith("Bearer ")) return false;
    const token = auth.slice("Bearer ".length).trim();
    if (!ADMIN_SECRET) return false;
    return token === ADMIN_SECRET;
  } catch (_) {
    return false;
  }
}

// List tokens (prefix + createdAt only)
app.get("/tokens", (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const list = Array.from(issuedTokens).map((t) => {
    // Try to resolve current display name from active connections using this token
    let currentName = null;
    try {
      for (const ws of clients) {
        if (ws && ws.readyState === ws.OPEN && ws.user?.token === t) {
          currentName = ws.user?.name || null;
          break;
        }
      }
      if (!currentName) {
        for (const ws of wss.clients) {
          if (ws && ws.readyState === ws.OPEN && ws.user?.token === t) {
            currentName = ws.user?.name || null;
            break;
          }
        }
      }
    } catch (_) {}
    return {
      prefix: String(t).slice(0, 8),
      createdAt: issuedTokenMeta.get(t)?.createdAt || null,
      ownerId: issuedTokenMeta.get(t)?.ownerId || null,
      deviceId: issuedTokenMeta.get(t)?.deviceId || null,
      lastUsedAt: issuedTokenMeta.get(t)?.lastUsedAt || null,
      currentName,
    };
  });
  res.json({ tokens: list, count: list.length });
});

// Revoke token by exact value
app.delete("/revoke/:token", (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const raw = String(req.params.token || "");
  if (!raw) return res.status(404).json({ error: "Token not found" });

  // If exact match exists, revoke it. Otherwise, treat as prefix.
  let targetToken = null;
  if (issuedTokens.has(raw)) {
    targetToken = raw;
  } else {
    const matches = Array.from(issuedTokens).filter((t) => t.startsWith(raw));
    if (matches.length === 1) {
      targetToken = matches[0];
    } else if (matches.length === 0) {
      return res.status(404).json({ error: "Token not found" });
    } else {
      return res.status(400).json({ error: "Ambiguous prefix" });
    }
  }

  issuedTokens.delete(targetToken);
  issuedTokenMeta.delete(targetToken);
  persistIssuedTokens();
  const prefix = String(targetToken).slice(0, 8);
  console.log(`Revoked token ${prefix} by admin`);

  // Close active WS connections that used this token
  let closed = 0;
  try {
    // Close from our tracked set
    for (const ws of clients) {
      try {
        if (ws && ws.readyState === ws.OPEN && ws.user?.token === targetToken) {
          ws.close(4001, "Token revoked");
          closed += 1;
        }
      } catch (_) {}
    }
    // Also iterate native wss.clients for safety
    for (const ws of wss.clients) {
      try {
        if (ws && ws.readyState === ws.OPEN && ws.user?.token === targetToken) {
          ws.close(4001, "Token revoked");
          closed += 1;
        }
      } catch (_) {}
    }
    if (closed > 0) {
      console.log(`Closed ${closed} WS connection(s) for revoked token ${prefix}`);
    }
  } catch (_) {}
  res.json({ revoked: prefix, closed });
});

// Reassign token ownerId (admin only)
app.patch("/reassign-owner/:token", express.json({ limit: "32kb" }), (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const raw = String(req.params.token || "").trim();
  const newOwner = String(req.body?.ownerId || "").trim();
  if (!raw) return res.status(404).json({ error: "Token not found" });
  if (!newOwner) return res.status(400).json({ error: "invalid_owner" });

  let targetToken = null;
  if (issuedTokens.has(raw)) {
    targetToken = raw;
  } else {
    const matches = Array.from(issuedTokens).filter((t) => t.startsWith(raw));
    if (matches.length === 1) targetToken = matches[0];
  }
  if (!targetToken) return res.status(404).json({ error: "Token not found" });

  // Update metadata
  const meta = issuedTokenMeta.get(targetToken) || { createdAt: new Date().toISOString() };
  meta.ownerId = newOwner;
  issuedTokenMeta.set(targetToken, meta);
  persistIssuedTokens();

  // Close any active WS connections for this token to force re-auth with correct owner
  let closed = 0;
  try {
    for (const ws of clients) {
      try {
        if (ws && ws.readyState === ws.OPEN && ws.user?.token === targetToken) {
          ws.close(4001, "Token owner changed");
          closed += 1;
        }
      } catch (_) {}
    }
    for (const ws of wss.clients) {
      try {
        if (ws && ws.readyState === ws.OPEN && ws.user?.token === targetToken) {
          ws.close(4001, "Token owner changed");
          closed += 1;
        }
      } catch (_) {}
    }
  } catch (_) {}

  return res.json({ ok: true, tokenPrefix: targetToken.slice(0, 8), ownerPrefix: newOwner.slice(0, 8), closed });
});

// Self-revoke: allow a client to revoke its own token without admin secret
app.delete("/revoke-self", (req, res) => {
  try {
    // Expect Authorization: Bearer <client-token>
    const auth = String(req.header("authorization") || "");
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = auth.slice("bearer ".length).trim();
    if (!token) return res.status(400).json({ error: "invalid_token" });
    if (!issuedTokens.has(token)) {
      return res.status(404).json({ error: "Token not found" });
    }

    issuedTokens.delete(token);
    issuedTokenMeta.delete(token);
    persistIssuedTokens();
    const prefix = token.slice(0, 8);
    console.log(`Self-revoked token ${prefix}`);

    // Close any active WS connections that used this token
    let closed = 0;
    try {
      for (const ws of clients) {
        try {
          if (ws && ws.readyState === ws.OPEN && ws.user?.token === token) {
            ws.close(4001, "Token revoked");
            closed += 1;
          }
        } catch (_) {}
      }
      for (const ws of wss.clients) {
        try {
          if (ws && ws.readyState === ws.OPEN && ws.user?.token === token) {
            ws.close(4001, "Token revoked");
            closed += 1;
          }
        } catch (_) {}
      }
      if (closed > 0) {
        console.log(`Closed ${closed} WS connection(s) for self-revoked token ${prefix}`);
      }
    } catch (_) {}

    return res.json({ revoked: prefix, closed });
  } catch (e) {
    return res.status(500).json({ error: "revoke_error" });
  }
});

// Simple admin dashboard (HTML) protected via ?secret=...
app.get("/admin", (req, res) => {
  try {
    // Serve the Admin UI even without a query secret; the UI will prompt for it.
    if (!ADMIN_SECRET) {
      return res.status(401).send("Unauthorized (ADMIN_SECRET not configured)");
    }
    res.setHeader("content-type", "text/html; charset=utf-8");

    // Per-request nonces for CSP
    const crypto = require("crypto");
    const scriptNonce = crypto.randomBytes(16).toString("base64");
    const styleNonce = crypto.randomBytes(16).toString("base64");

    // Tight CSP: allow self + nonced inline for script/style
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        `script-src 'self' 'nonce-${scriptNonce}'`,
        `style-src 'self' 'nonce-${styleNonce}'`,
        "img-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    );

    const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shoutout Admin</title>
    <style nonce="${styleNonce}">
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#0f1115; color:#e5e7eb; margin:0; }
      header { padding:16px 20px; border-bottom:1px solid #1f2937; font-weight:600; }
      main { padding:20px; }
      table { width:100%; border-collapse: collapse; }
      th, td { text-align:left; padding:10px 12px; border-bottom:1px solid #1f2937; }
      th { color:#93c5fd; font-weight:600; }
      .btn { background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; }
      .muted { color:#9ca3af; font-size: 12px; }
      .wrap { max-width: 900px; margin: 0 auto; }
      .login { max-width: 460px; margin: 32px auto; background:#111827; border:1px solid #1f2937; border-radius:10px; padding:16px; }
      .row { display:flex; gap:8px; }
      input[type="password"] { flex:1; background:#0b1220; color:#e5e7eb; border:1px solid #1f2937; border-radius:8px; padding:10px 12px; outline:none; }
      .btn-blue { background:#3b82f6; color:#fff; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; }
      .topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .right { display:flex; align-items:center; gap:8px; }
      .hidden { display:none; }
      .error { color:#f87171; font-size:13px; min-height:18px; margin-top:8px; }
      .mb-8 { margin-bottom: 8px; }
      .mt-8 { margin-top: 8px; }
    </style>
  </head>
  <body>
    <header>
      <div class="wrap topbar">
        <div>Shoutout Admin</div>
        <div class="right">
          <button id="logout" class="btn hidden">Logout</button>
        </div>
      </div>
    </header>
    <main>
      <div id="login" class="login hidden">
        <div class="muted mb-8">Admin-Secret eingeben</div>
        <div class="row">
          <input id="secret" type="password" placeholder="Passwort" autocomplete="off" />
          <button id="loginBtn" class="btn-blue">Login</button>
        </div>
        <div id="err" class="error"></div>
        <div class="muted mt-8">Das Secret wird lokal im Browser (sessionStorage) gespeichert.</div>
      </div>

      <div id="app" class="wrap hidden">
        <p class="muted">Tokens ansehen und widerrufen. Aktionen verwenden das gespeicherte Admin-Secret für API-Aufrufe.</p>
        <table id="toktbl">
          <thead>
            <tr>
              <th>Token Prefix</th>
              <th>Created At</th>
              <th>Owner</th>
              <th>Name</th>
              <th>Device</th>
              <th>Last Used</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody id="tb"></tbody>
        </table>
      </div>
    </main>
    <script nonce="${scriptNonce}">
      (function(){
        const loginBox = document.getElementById('login');
        const appBox = document.getElementById('app');
        const logoutBtn = document.getElementById('logout');
        const secretEl = document.getElementById('secret');
        const loginBtn = document.getElementById('loginBtn');
        const errEl = document.getElementById('err');

        function getSecret() {
          const params = new URLSearchParams(window.location.search);
          const fromQuery = params.get('secret');
          if (fromQuery) return fromQuery;
          try { return sessionStorage.getItem('adminSecret') || ''; } catch(_) { return ''; }
        }
        function setSecret(value){ try { sessionStorage.setItem('adminSecret', value || ''); } catch(_) {} }
        function clearSecret(){ try { sessionStorage.removeItem('adminSecret'); } catch(_) {} }
        function setError(msg){ errEl.textContent = msg || ''; }

        async function loadTokens(){
          try{
            const adminSecret = getSecret();
            if (!adminSecret) { throw new Error('NO_SECRET'); }
            const resp = await fetch('/tokens', { headers: { Authorization: 'Bearer ' + adminSecret } });
            if(!resp.ok){ throw new Error('HTTP ' + resp.status); }
            const data = await resp.json();
            const tb = document.getElementById('tb');
            tb.innerHTML='';
            (data.tokens || []).forEach(row => {
              const tr = document.createElement('tr');
              const tdP = document.createElement('td'); tdP.textContent = row.prefix; tr.appendChild(tdP);
              const tdC = document.createElement('td'); tdC.textContent = row.createdAt || ''; tr.appendChild(tdC);
              const tdO = document.createElement('td'); tdO.textContent = row.ownerId ? (row.ownerId.slice(0,8) + '…') : ''; tr.appendChild(tdO);
              const tdN = document.createElement('td'); tdN.textContent = row.currentName || ''; tr.appendChild(tdN);
              const tdD = document.createElement('td'); tdD.textContent = row.deviceId ? (row.deviceId.slice(0,8) + '…') : ''; tr.appendChild(tdD);
              const tdL = document.createElement('td'); tdL.textContent = row.lastUsedAt || ''; tr.appendChild(tdL);
              const tdA = document.createElement('td');
              // Revoke button
              const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Revoke';
              btn.style.marginRight = '8px';
              btn.addEventListener('click', async () => {
                if(!confirm('Diesen Token widerrufen?')) return;
                try{
                  const adminSecret = getSecret();
                  // Revocation by prefix (server accepts exact match or unique prefix)
                  const r = await fetch('/revoke/' + encodeURIComponent(row.prefix), { method: 'DELETE', headers: { Authorization: 'Bearer ' + adminSecret } });
                  if(r.ok){
                    let msg = 'Token ' + row.prefix + ' revoked.';
                    try { const j = await r.json(); if (typeof j.closed === 'number') msg += ' Closed ' + j.closed + ' connection(s).'; } catch(_){ }
                    alert(msg);
                    tr.remove();
                  }
                  else { alert('Fehlgeschlagen: ' + r.status); }
                }catch(e){ alert('Fehler: ' + (e && e.message || e)); }
              });
              tdA.appendChild(btn);
              // Reassign owner button
              const btnOwner = document.createElement('button'); btnOwner.className='btn'; btnOwner.textContent='Owner…'; btnOwner.style.background = '#6b7280';
              btnOwner.addEventListener('click', async () => {
                const newOwner = prompt('Neue Owner-ID (UserID) für Token ' + row.prefix + ':', row.ownerId || '');
                if(!newOwner) return;
                try{
                  const adminSecret = getSecret();
                  const r = await fetch('/reassign-owner/' + encodeURIComponent(row.prefix), { method: 'PATCH', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + adminSecret }, body: JSON.stringify({ ownerId: newOwner }) });
                  if(r.ok){
                    alert('Owner aktualisiert. Aktive Verbindungen werden getrennt.');
                    // Update cell
                    tdO.textContent = newOwner ? (newOwner.slice(0,8) + '…') : '';
                    tdN.textContent = '';
                  } else {
                    alert('Fehlgeschlagen: ' + r.status);
                  }
                }catch(e){ alert('Fehler: ' + (e && e.message || e)); }
              });
              tdA.appendChild(btnOwner);
              tr.appendChild(tdA);
              tb.appendChild(tr);
            });
            if((data.tokens || []).length===0){
              document.getElementById('tb').innerHTML = '<tr><td colspan="3">Keine Tokens</td></tr>';
            }
            // UI state
            loginBox.classList.add('hidden');
            appBox.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
          }catch(e){
            // If unauthorized or missing secret, show login box
            appBox.classList.add('hidden');
            loginBox.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            if ((e && e.message === 'NO_SECRET') || /401/.test(String(e))) {
              setError('Bitte gültiges Secret eingeben');
            } else {
              setError('Fehler beim Laden');
            }
          }
        }
        // Login handlers
        loginBtn.addEventListener('click', async () => {
          const value = String(secretEl.value || '').trim();
          if (!value) { setError('Bitte Secret eingeben'); secretEl.focus(); return; }
          setError('');
          setSecret(value);
          await loadTokens();
        });
        secretEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
        logoutBtn.addEventListener('click', () => { clearSecret(); loadTokens(); });

        // Auto-attempt using query or stored secret
        loadTokens();
      })();
    </script>
  </body>
</html>`;
    res.send(html);
  } catch (e) {
    res.status(500).send("Admin page error");
  }
});

// Quietly handle favicon requests from browsers
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Invite endpoint: exchange inviteCode for a client token
app.post("/invite", express.json({ limit: "64kb" }), (req, res) => {
  try {
    const inviteCode = String(req.body?.inviteCode || "").trim();
    const ownerId = String(req.body?.ownerId || "").trim();
    const deviceId = String(req.body?.deviceId || "").trim();
    if (!inviteCode) {
      return res.status(400).json({ error: "invalid_invite_code" });
    }
    if (!ownerId) {
      return res.status(400).json({ error: "invalid_owner" });
    }

    // Support invite codes from env or from config/invites.json
    let validCodes = [...INVITE_CODES];
    try {
      const invitePath = path.join(__dirname, "..", "config", "invites.json");
      if (fs.existsSync(invitePath)) {
        const arr = JSON.parse(fs.readFileSync(invitePath, "utf-8"));
        if (Array.isArray(arr)) {
          validCodes = [...new Set([...validCodes, ...arr.map((s) => String(s).trim())])].filter(Boolean);
        }
      }
    } catch (_) {}

    // If no invite codes are configured anywhere, disable issuance explicitly
    if (!validCodes || validCodes.length === 0) {
      logger.warn("Invite Disabled", { event: "invite_disabled", reason: "no_valid_codes" });
      return res.status(403).json({ error: "invite_disabled" });
    }

    if (!validCodes.includes(inviteCode)) {
      logger.warn("Invite Failed", { event: "invite_failed", ip: req.ip });
      return res.status(403).json({ error: "forbidden" });
    }

    const token = generateToken();
    issuedTokens.add(token);
    issuedTokenMeta.set(token, { createdAt: new Date().toISOString(), ownerId, deviceId: deviceId || null, lastUsedAt: null });
    persistIssuedTokens();

    logger.info("Invite Issued", {
      event: "invite_issued",
      ip: req.ip,
      tokenPrefix: token.slice(0, 8),
      ownerPrefix: ownerId.slice(0, 8),
      devicePrefix: deviceId ? deviceId.slice(0, 8) : undefined,
    });
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: "invite_error" });
  }
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
    // Allow cross-origin resource usage for <img> tags in Electron/file:// contexts
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    const stream = fs.createReadStream(imagePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Error serving hamster image:", error);
    res.status(500).json({ error: "Failed to serve hamster image" });
  }
});

// Neue Endpoints für User-Management
app.get("/users", usersLimiter, (req, res) => {
  if (!isAuthorizedRead(req)) return res.status(401).json({ error: "Unauthorized" });
  const activeUsers = Array.from(clients)
    .filter((ws) => ws.readyState === ws.OPEN && ws.user?.name)
    .map((ws) => ({
      id: ws.user?.id || ws.user?.name,
      name: ws.user?.name,
      // Do not expose IP in public list
      displayName: ws.user?.name,
      status: ws.user?.status || "online",
      // no ip field in public response
      lastSeen: ws.user?.lastSeen || new Date().toISOString(),
      connectedAt: ws.user?.connectedAt || new Date().toISOString(),
    }));

  res.json({
    users: activeUsers,
    count: activeUsers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/users/:userId", usersLimiter, (req, res) => {
  if (!isAuthorizedRead(req)) return res.status(401).json({ error: "Unauthorized" });
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
    // do not expose IP in public detail
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

// Translation API (optional)
app.post("/translate", translateLimiter, express.json({ limit: "128kb" }), async (req, res) => {
  try {
    if (!isAuthorizedRead(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!TRANSLATOR_ENABLED) {
      return res.status(503).json({ error: "translator_disabled" });
    }
    // Validate payload strictly
    const translateSchema = Joi.object({
      text: Joi.string().min(1).max(8000).required(),
      direction: Joi.string().valid("auto", "de->en", "en->de").default("auto"),
      formatMode: Joi.string().valid("auto", "plain", "email").default("auto"),
    }).required();
    const { error, value } = translateSchema.validate(req.body || {}, { stripUnknown: true });
    if (error) return res.status(400).json({ error: "invalid_payload" });

    const result = await translatePipeline({
      text: value.text,
      direction: value.direction,
      formatMode: value.formatMode,
    });
    const ok = typeof result.ok === "boolean" ? result.ok : true;
    if (!ok) {
      logger.warn("Translation fallback", {
        event: "translation_fallback",
        reason: result?.meta?.reason || "unknown",
        provider: TRANSLATOR_PROVIDER,
      });
    }
    res.json({ ok, ...result });
  } catch (error) {
    console.error("/translate error:", error);
    res.status(500).json({ error: "translate_failed" });
  }
});
