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
    ws.user = { name };
  } catch (_) {
    ws.user = { name: "Anonymous" };
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
      const { error, value } = eventSchema.validate(parsed, {
        stripUnknown: true,
      });
      if (error) return;
      const outbound = { ...value, sender: ws.user?.name || "Anonymous" };
      const payload = JSON.stringify(outbound);
      for (const c of clients) {
        if (c.readyState === c.OPEN) {
          try {
            c.send(payload);
          } catch (_) {}
        }
      }
    } catch (_) {}
  });

  ws.on("close", () => clients.delete(ws));
});

// Validation schemas
const hamsterSchema = Joi.object({
  type: Joi.string().valid("hamster").required(),
  variant: Joi.string().min(1).max(64).default("default"),
  duration: Joi.number().integer().min(300).max(30000).default(3000),
  target: Joi.string().optional(),
}).required();

const toastSchema = Joi.object({
  type: Joi.string().valid("toast").required(),
  message: Joi.string().min(1).max(280).required(),
  severity: Joi.string()
    .valid("info", "success", "warn", "critical")
    .default("info"),
  duration: Joi.number().integer().min(500).max(30000).default(4000),
  target: Joi.string().optional(),
}).required();

const eventSchema = Joi.alternatives().try(hamsterSchema, toastSchema);

// Helpers
function isAuthorized(req) {
  const auth = req.header("authorization") || "";
  if (ALLOW_NO_AUTH) return true;
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length);
  return token === BROADCAST_SECRET;
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

  const payload = JSON.stringify(value);
  // Broadcast to all clients
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
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
