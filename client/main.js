require("dotenv").config();
const path = require("path");
const { pathToFileURL } = require("url");
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
} = require("electron");
const WebSocket = require("ws");

const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws";
const WS_TOKEN = process.env.WS_TOKEN || "";

let tray = null;
let overlayWindow = null;
let doNotDisturb = false;
let ws = null;
let displayName = null;
let wsConnectToken = 0;
let lastSeverity = "blue";

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 420,
    height: 240,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.loadFile(path.join(__dirname, "renderer", "overlay.html"));
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.showInactive();
}

function positionOverlayTopRight() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const margin = 20;
  const currentBounds = overlayWindow.getBounds();
  let target = screen.getPrimaryDisplay();
  try {
    const pt = screen.getCursorScreenPoint();
    target = screen.getDisplayNearestPoint(pt) || target;
  } catch (_) {}
  const work = target.workArea;
  const x = Math.floor(work.x + work.width - currentBounds.width - margin);
  const y = Math.floor(work.y + margin);
  overlayWindow.setPosition(x, y);
}

function showHamster(variant, durationMs, sender) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlayTopRight();
  const imgFsPath = path.join(
    __dirname,
    "assets",
    "hamsters",
    `${variant}.png`
  );
  const fileUrl = pathToFileURL(imgFsPath).href;
  overlayWindow.webContents.send("show-hamster", {
    variant,
    durationMs,
    url: fileUrl,
    sender,
  });
}

function showToast(message, severity, durationMs, sender) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlayTopRight();
  overlayWindow.webContents.send("show-toast", {
    message,
    severity,
    durationMs,
    sender,
  });
}

function connectWebSocket() {
  const token = ++wsConnectToken;
  const url = new URL(WS_URL);
  if (WS_TOKEN) url.searchParams.set("token", WS_TOKEN);
  if (displayName) url.searchParams.set("name", displayName);

  function doConnect() {
    if (token !== wsConnectToken) return; // aborted by newer connect
    ws = new WebSocket(url.toString());

    ws.on("open", () => {
      console.log("WS connected");
    });
    ws.on("message", (data) => {
      if (doNotDisturb) return;
      try {
        const event = JSON.parse(String(data));
        if (event.type === "hamster") {
          showHamster(
            event.variant || "default",
            event.duration || 3000,
            event.sender
          );
        } else if (event.type === "toast") {
          showToast(
            event.message || "",
            event.severity || "info",
            event.duration || 4000,
            event.sender
          );
        }
      } catch (e) {
        console.error("Invalid WS message", e);
      }
    });
    ws.on("close", () => {
      console.log("WS disconnected, retrying in 2s");
      setTimeout(() => {
        if (token === wsConnectToken) doConnect();
      }, 2000);
    });
    ws.on("error", () => {
      // handled by 'close' retry
    });
  }

  doConnect();
}

function reconnectWebSocket() {
  try {
    wsConnectToken++;
  } catch (_) {}
  try {
    if (ws) ws.close();
  } catch (_) {}
  connectWebSocket();
}

function createTray() {
  // Try to load a platform icon; fallback to empty
  let trayImage = null;
  try {
    const fs = require("fs");
    const iconDir = path.join(__dirname, "assets", "icon");
    // User-provided icons
    const winPrimary = path.join(iconDir, "hamster.ico");
    const winFallback = path.join(iconDir, "icon.ico");
    const macPrimary = path.join(iconDir, "hamster.png");
    const macTemplate = path.join(iconDir, "iconTemplate.png"); // monochrome template (optional)
    const pngFallback = path.join(iconDir, "icon.png");

    // Choose best candidate per platform
    let chosenPath;
    if (process.platform === "win32") {
      chosenPath = fs.existsSync(winPrimary) ? winPrimary : winFallback;
    } else if (process.platform === "darwin") {
      chosenPath = fs.existsSync(macPrimary)
        ? macPrimary
        : fs.existsSync(macTemplate)
        ? macTemplate
        : pngFallback;
    } else {
      chosenPath = fs.existsSync(macPrimary) ? macPrimary : pngFallback;
    }

    let baseImage = nativeImage.createFromPath(chosenPath);
    if (!baseImage || baseImage.isEmpty()) {
      // Try additional fallbacks
      const nextFallback =
        process.platform === "win32" ? winFallback : pngFallback;
      baseImage = nativeImage.createFromPath(nextFallback);
    }
    if (!baseImage || baseImage.isEmpty()) {
      baseImage = nativeImage.createEmpty();
    }

    // On macOS, provide correctly sized representations for the menu bar (1x/2x)
    if (process.platform === "darwin") {
      try {
        const img1x = baseImage.resize({ width: 18, height: 18 });
        const img2x = baseImage.resize({ width: 36, height: 36 });
        const multi = nativeImage.createEmpty();
        multi.addRepresentation({
          scaleFactor: 1.0,
          width: 18,
          height: 18,
          buffer: img1x.toPNG(),
        });
        multi.addRepresentation({
          scaleFactor: 2.0,
          width: 36,
          height: 36,
          buffer: img2x.toPNG(),
        });
        trayImage = multi;
        // If a template icon is available/used, mark it so macOS adapts to light/dark
        if (chosenPath.endsWith("iconTemplate.png")) {
          try {
            trayImage.setTemplateImage(true);
          } catch (_) {}
        }
      } catch (_) {
        trayImage = baseImage; // graceful fallback
      }
    } else {
      trayImage = baseImage;
    }
  } catch (_) {
    trayImage = nativeImage.createEmpty();
  }
  tray = new Tray(trayImage);
  if (process.platform === "darwin") {
    // Only use emoji title if no icon asset is available
    try {
      if (!trayImage || trayImage.isEmpty()) {
        tray.setTitle("🐹");
      } else {
        tray.setTitle("");
      }
    } catch (_) {}
  }
  tray.on("click", () => {
    try {
      tray.popUpContextMenu();
    } catch (_) {}
  });
  buildTrayMenu();
}

function registerHotkey() {
  const bindings = [
    {
      acc: "CommandOrControl+Alt+H",
      run: () => showHamster("default", 3000, displayName),
    },
    { acc: "CommandOrControl+Alt+T", run: () => openToastPrompt() },
    {
      acc: "CommandOrControl+Alt+1",
      run: () => sendHamsterUpstream("caprisun", 3000),
    },
    {
      acc: "CommandOrControl+Alt+2",
      run: () => sendHamsterUpstream("lol", 3000),
    },
  ];
  for (const { acc, run } of bindings) {
    try {
      globalShortcut.register(acc, run);
    } catch (_) {}
  }
}

app.whenReady().then(() => {
  createOverlayWindow();
  createTray();
  registerHotkey();
  ensureDisplayName().then(() => {
    connectWebSocket();
    buildTrayMenu();
  });

  // Position overlay top-right on primary display
  positionOverlayTopRight();
  try {
    screen.on("display-added", positionOverlayTopRight);
    screen.on("display-removed", positionOverlayTopRight);
    screen.on("display-metrics-changed", positionOverlayTopRight);
  } catch (_) {}
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  if (ws && ws.readyState === ws.OPEN) ws.close();
});

// Simple sender helpers
function sendHamsterUpstream(variant, durationMs) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "hamster", variant, duration: durationMs }));
  }
  // Local echo for the sender
  showHamster(variant, durationMs, displayName);
}

function openToastPrompt() {
  const composeWin = new BrowserWindow({
    width: 560,
    height: 360,
    resizable: true,
    modal: true,
    frame: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_compose.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  composeWin.loadFile(path.join(__dirname, "renderer", "compose.html"), {
    query: { sev: String(lastSeverity || "blue") },
  });
  const onSubmit = (_evt, payload) => {
    try {
      ipcMain.removeListener("compose-toast-cancel", onCancel);
    } catch (_) {}
    const message = String(payload?.message || "").slice(0, 280);
    const severity = [
      "blue",
      "green",
      "pink",
      "red",
      "info",
      "success",
      "warn",
      "critical",
    ].includes(payload?.severity)
      ? payload.severity
      : "blue";
    const duration = Math.max(
      500,
      Math.min(10000, Number(payload?.duration || 3000))
    );
    if (ws && ws.readyState === ws.OPEN && message) {
      ws.send(JSON.stringify({ type: "toast", message, severity, duration }));
    }
    try {
      updateSettings({ lastSeverity: severity });
      lastSeverity = severity;
    } catch (_) {}
    try {
      composeWin.close();
    } catch (_) {}
  };
  const onCancel = () => {
    try {
      ipcMain.removeListener("compose-toast-submit", onSubmit);
    } catch (_) {}
    try {
      composeWin.close();
    } catch (_) {}
  };
  ipcMain.once("compose-toast-submit", onSubmit);
  ipcMain.once("compose-toast-cancel", onCancel);
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "shoutout-user.json");
}

function readSettings() {
  try {
    const fs = require("fs");
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw || "{}") || {};
  } catch (_) {
    return {};
  }
}

function updateSettings(patch) {
  const fs = require("fs");
  const p = getSettingsPath();
  let curr = {};
  try {
    curr = readSettings();
  } catch (_) {}
  const next = { ...curr, ...patch };
  try {
    fs.writeFileSync(p, JSON.stringify(next), "utf-8");
  } catch (_) {}
}

function buildTrayMenu() {
  if (!tray) return;
  const template = [
    { label: `Du bist: ${displayName || "Anonymous"}`, enabled: false },
    { type: "separator" },
    {
      label: "Do Not Disturb",
      type: "checkbox",
      checked: doNotDisturb,
      click: (item) => {
        doNotDisturb = item.checked;
      },
    },
    { type: "separator" },
    {
      label: "Self Hamster (Ctrl/Cmd+Alt+H)",
      click: () => showHamster("default", 3000),
    },
    { label: "Name ändern…", click: () => openNamePrompt() },
    {
      label: "Send Hamster...",
      submenu: [
        {
          label: "caprisun",
          click: () => sendHamsterUpstream("caprisun", 3000),
        },
        { label: "lol", click: () => sendHamsterUpstream("lol", 3000) },
      ],
    },
    { label: "Send Toast...", click: () => openToastPrompt() },
    { type: "separator" },
    { role: "quit" },
  ];
  try {
    tray.setContextMenu(Menu.buildFromTemplate(template));
    tray.setToolTip(`Hamster & Toast${displayName ? ` — ${displayName}` : ""}`);
  } catch (_) {}
}

function openNamePrompt() {
  const nameWin = new BrowserWindow({
    width: 420,
    height: 200,
    resizable: false,
    modal: true,
    frame: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_name.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  nameWin.loadFile(path.join(__dirname, "renderer", "name.html"), {
    query: { current: String(displayName || "") },
  });
  const onSubmit = (_evt, payload) => {
    try {
      ipcMain.removeListener("name-cancel", onCancel);
    } catch (_) {}
    const next = String(payload?.name || "")
      .trim()
      .slice(0, 24);
    if (next.length >= 2) {
      try {
        updateSettings({ displayName: next });
      } catch (_) {}
      displayName = next;
      reconnectWebSocket();
      buildTrayMenu();
    }
    try {
      nameWin.close();
    } catch (_) {}
  };
  const onCancel = () => {
    try {
      ipcMain.removeListener("name-submit", onSubmit);
    } catch (_) {}
    try {
      nameWin.close();
    } catch (_) {}
  };
  ipcMain.once("name-submit", onSubmit);
  ipcMain.once("name-cancel", onCancel);
}

async function ensureDisplayName() {
  const settings = readSettings();
  if (settings && typeof settings === "object") {
    if (settings.displayName) {
      displayName = String(settings.displayName).slice(0, 32);
    }
    if (settings.lastSeverity) {
      lastSeverity = String(settings.lastSeverity);
    }
  }
  if (!displayName) {
    const os = require("os");
    displayName = (os.userInfo().username || "Anonymous").slice(0, 32);
    updateSettings({ displayName });
  }
}
