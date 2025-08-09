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
  const url = new URL(WS_URL);
  if (WS_TOKEN) url.searchParams.set("token", WS_TOKEN);
  if (displayName) url.searchParams.set("name", displayName);

  function doConnect() {
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
      setTimeout(doConnect, 2000);
    });
    ws.on("error", () => {
      // handled by 'close' retry
    });
  }

  doConnect();
}

function createTray() {
  // Try to load a platform icon; fallback to empty
  let trayImage = null;
  try {
    const iconDir = path.join(__dirname, "assets", "icon");
    const winIcon = path.join(iconDir, "icon.ico");
    const macIcon = path.join(iconDir, "iconTemplate.png");
    const pngIcon = path.join(iconDir, "icon.png");
    const candidate = process.platform === "win32" ? winIcon : (process.platform === "darwin" ? macIcon : pngIcon);
    trayImage = nativeImage.createFromPath(candidate);
    if (!trayImage || trayImage.isEmpty()) trayImage = nativeImage.createFromPath(pngIcon);
  } catch (_) {
    trayImage = nativeImage.createEmpty();
  }
  tray = new Tray(trayImage);
  if (process.platform === "darwin") {
    // Show an emoji title so the tray is visible without bundling an icon
    try {
      tray.setTitle("🐹");
    } catch (_) {}
  }
  tray.on("click", () => {
    try {
      tray.popUpContextMenu();
    } catch (_) {}
  });
  const contextMenu = Menu.buildFromTemplate([
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
    {
      label: "Send Toast...",
      click: () => openToastPrompt(),
    },
    { type: "separator" },
    { role: "quit" },
  ]);
  tray.setToolTip("Hamster & Toast");
  tray.setContextMenu(contextMenu);
}

function registerHotkey() {
  const accelerator =
    process.platform === "darwin" ? "Command+Alt+H" : "Control+Alt+H";
  globalShortcut.register(accelerator, () => {
    showHamster("default", 3000);
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
  createTray();
  registerHotkey();
  ensureDisplayName().then(() => connectWebSocket());

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
  composeWin.loadFile(path.join(__dirname, "renderer", "compose.html"));
  const onSubmit = (_evt, payload) => {
    try {
      ipcMain.removeListener("compose-toast-cancel", onCancel);
    } catch (_) {}
    const message = String(payload?.message || "").slice(0, 280);
    const severity = ["info", "success", "warn", "critical"].includes(
      payload?.severity
    )
      ? payload.severity
      : "info";
    const duration = Math.max(
      500,
      Math.min(10000, Number(payload?.duration || 3000))
    );
    if (ws && ws.readyState === ws.OPEN && message) {
      ws.send(JSON.stringify({ type: "toast", message, severity, duration }));
    }
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

async function ensureDisplayName() {
  const storePath = path.join(app.getPath("userData"), "shoutout-user.json");
  try {
    const fs = require("fs");
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.displayName) {
        displayName = String(parsed.displayName).slice(0, 32);
        return;
      }
    }
  } catch (_) {}
  // Minimal name selection via first launch default; replace with a small modal later
  const os = require("os");
  displayName = (os.userInfo().username || "Anonymous").slice(0, 32);
  try {
    const fs = require("fs");
    fs.writeFileSync(storePath, JSON.stringify({ displayName }), "utf-8");
  } catch (_) {}
}
