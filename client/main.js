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
const fs = require("fs");

const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws";
const WS_TOKEN = process.env.WS_TOKEN || "";

let tray = null;
let overlayWindow = null;
let doNotDisturb = false; // Will be loaded from settings on startup
let autostartEnabled = false; // Will be loaded from settings on startup
let ws = null;
let wsStatus = "disconnected"; // "connected", "connecting", "disconnected"
let displayName = null;
let availableHamsters = []; // Dynamically loaded hamster variants
let wsConnectToken = 0;
let lastSeverity = "blue";

function createOverlayWindow() {
  console.log(`🏗️ Creating overlay window...`);

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

  console.log(`📁 Loading overlay.html...`);
  overlayWindow.loadFile(path.join(__dirname, "renderer", "overlay.html"));

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Mouse-Events nur ignorieren wenn keine Toasts aktiv sind
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.showInactive();

  console.log(`✅ Overlay window created and shown`);

  // Event-Listener für das Laden
  overlayWindow.webContents.once("did-finish-load", () => {
    console.log(`🎯 Overlay window finished loading`);
  });

  overlayWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error(
        `❌ Overlay window failed to load:`,
        errorCode,
        errorDescription
      );
    }
  );
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
  console.log(
    `🐹 showHamster: variant=${variant}, durationMs=${durationMs}, sender=${sender}`
  );

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    console.log(`❌ Overlay window not available or destroyed`);
    return;
  }

  // Prüfen, ob das Overlay-Window bereit ist
  if (
    !overlayWindow.webContents.isLoading() &&
    overlayWindow.webContents.getTitle() !== ""
  ) {
    console.log(`📍 Positioning overlay`);
    positionOverlayTopRight();

    const imgFsPath = path.join(
      __dirname,
      "assets",
      "hamsters",
      `${variant}.png`
    );
    const fileUrl = pathToFileURL(imgFsPath).href;
    console.log(`🖼️ Image path: ${imgFsPath}`);
    console.log(`🔗 File URL: ${fileUrl}`);

    const payload = {
      variant,
      durationMs,
      url: fileUrl,
      sender,
    };
    console.log(`📤 Sending show-hamster IPC:`, payload);

    try {
      overlayWindow.webContents.send("show-hamster", payload);
      console.log(`✅ show-hamster IPC sent successfully`);
    } catch (error) {
      console.error(`❌ Failed to send show-hamster IPC:`, error);
    }
  } else {
    console.log(`⏳ Overlay window not ready yet, retrying in 100ms...`);
    setTimeout(() => showHamster(variant, durationMs, sender), 100);
  }
}

function showToast(message, severity, durationMs, sender, recipientInfo) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlayTopRight();
  overlayWindow.webContents.send("show-toast", {
    message,
    severity,
    durationMs,
    sender,
    recipientInfo,
  });
}

function connectWebSocket() {
  const token = ++wsConnectToken;
  const url = new URL(WS_URL);
  if (WS_TOKEN) url.searchParams.set("token", WS_TOKEN);
  if (displayName) url.searchParams.set("name", displayName);

  function doConnect() {
    if (token !== wsConnectToken) return; // aborted by newer connect
    wsStatus = "connecting";
    updateTrayMenu();
    ws = new WebSocket(url.toString());

    ws.on("open", () => {
      console.log("🔌 WS connected successfully");
      wsStatus = "connected";
      updateTrayMenu();
      console.log("📝 Calling updateServerName...");
      updateServerName(); // Sende aktuellen Namen beim Verbinden
    });
    ws.on("message", (data) => {
      console.log(
        `📨 WS message received: ${String(data).substring(0, 100)}...`
      );

      if (doNotDisturb) {
        console.log(`🚫 DND active, ignoring message`);
        return;
      }

      try {
        const event = JSON.parse(String(data));
        console.log(`📋 Parsed event:`, event);

        if (event.type === "hamster") {
          console.log(
            `🐹 Showing hamster: ${event.variant} from ${event.sender}`
          );
          showHamster(
            event.variant || "default",
            event.duration || 3000,
            event.sender
          );
        } else if (event.type === "toast") {
          console.log(
            `🍞 Showing toast: "${event.message}" from ${event.sender}`
          );
          showToast(
            event.message || "",
            event.severity || "info",
            event.duration || 4000,
            event.sender,
            event.recipientInfo
          );
        }
      } catch (e) {
        console.error("Invalid WS message", e);
      }
    });
    ws.on("close", (code, reason) => {
      console.log(`🔌 WS disconnected: code=${code}, reason=${reason}`);
      wsStatus = "disconnected";
      updateTrayMenu();
      setTimeout(() => {
        if (token === wsConnectToken) doConnect();
      }, 2000);
    });
    ws.on("error", (error) => {
      console.error(`❌ WS error:`, error);
      wsStatus = "disconnected";
      updateTrayMenu();
      // handled by 'close' retry
    });
  }

  doConnect();
}

function reconnectWebSocket() {
  try {
    wsConnectToken++;
  } catch (_) {}

  // Sofort Status auf "connecting" setzen
  wsStatus = "connecting";
  updateTrayMenu();

  try {
    if (ws) {
      // WebSocket schließen und sofort neu verbinden
      ws.close();
      // Kurz warten, dann neu verbinden
      setTimeout(() => {
        connectWebSocket();
      }, 100);
    } else {
      // Kein WebSocket vorhanden, direkt neu verbinden
      connectWebSocket();
    }
  } catch (_) {
    // Bei Fehler trotzdem neu verbinden
    connectWebSocket();
  }
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
    console.log(`🖱️ Tray icon clicked`);
    try {
      // Menü synchron aufbauen und sofort anzeigen
      buildTrayMenu();
      // Kurze Verzögerung, um sicherzustellen, dass das Menü bereit ist
      setTimeout(() => {
        tray.popUpContextMenu();
        console.log(`✅ Context menu popped up`);
      }, 50);
    } catch (error) {
      console.error(`❌ Failed to pop up context menu:`, error);
    }
  });

  console.log(`🏗️ Building initial tray menu...`);
  buildTrayMenu();

  // Set initial tooltip and icon state
  console.log(`🎨 Updating tray icon...`);
  updateTrayIcon();

  console.log(`✅ Tray created successfully`);
}

function updateTrayMenu() {
  if (!tray) return;
  buildTrayMenu();
}

function updateTrayIcon() {
  if (!tray) return;

  try {
    const fs = require("fs");
    const iconDir = path.join(__dirname, "assets", "icon");

    // Simplified icon logic: Windows uses ICO, macOS uses PNG
    let iconPath;
    if (process.platform === "win32") {
      // Windows: Simple ICO logic
      iconPath = doNotDisturb
        ? path.join(iconDir, "hamster-sleep.ico") // DND active
        : path.join(iconDir, "hamster.ico"); // Normal mode
    } else {
      // macOS: Simple PNG logic
      iconPath = doNotDisturb
        ? path.join(iconDir, "hamster-sleep.png") // DND active
        : path.join(iconDir, "hamster.png"); // Normal mode
    }

    // Load the icon
    let baseImage = nativeImage.createFromPath(iconPath);

    // Check if image loaded successfully
    if (!baseImage || baseImage.isEmpty()) {
      const fallbackPath =
        process.platform === "win32"
          ? path.join(iconDir, "hamster.ico") // Windows fallback
          : path.join(iconDir, "hamster.png"); // macOS fallback

      baseImage = nativeImage.createFromPath(fallbackPath);

      // If fallback also fails, create empty image
      if (!baseImage || baseImage.isEmpty()) {
        baseImage = nativeImage.createEmpty();
      }
    }

    // Platform-specific image processing
    if (process.platform === "darwin") {
      // macOS: Create 1x and 2x representations for menu bar
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

        // Mark as template image for better macOS integration
        if (doNotDisturb) {
          try {
            multi.setTemplateImage(true);
          } catch (_) {}
        }

        tray.setImage(multi);
      } catch (error) {
        tray.setImage(baseImage); // graceful fallback
      }
    } else {
      // Windows: Enhanced ICO handling with multiple fallback strategies
      try {
        // Strategy 1: Direct update
        tray.setImage(baseImage);
      } catch (error) {
        try {
          // Strategy 2: Force refresh with empty image first
          tray.setImage(nativeImage.createEmpty());

          // Small delay to ensure Windows processes the change
          setTimeout(() => {
            try {
              tray.setImage(baseImage);
            } catch (error2) {
              // Strategy 3: Try to destroy and recreate tray (last resort)
              try {
                tray.destroy();
                setTimeout(() => {
                  createTray();
                }, 100);
              } catch (error3) {
                // Silent fallback
              }
            }
          }, 100);
        } catch (error2) {
          tray.setImage(baseImage);
        }
      }
    }

    // Update tooltip to show DND status and WS status
    const getStatusText = () => {
      switch (wsStatus) {
        case "connected":
          return "Online";
        case "connecting":
          return "Verbinde...";
        case "disconnected":
        default:
          return "Offline";
      }
    };

    const statusText = getStatusText();
    const tooltipText = doNotDisturb
      ? `Hamster & Toast — DND aktiv — ${statusText}${
          displayName ? ` — ${displayName}` : ""
        }`
      : `Hamster & Toast — ${statusText}${
          displayName ? ` — ${displayName}` : ""
        }`;
    tray.setToolTip(tooltipText);

    // Icon update completed successfully
  } catch (error) {
    // If icon update fails, keep current icon
  }
}

function updateDNDStatus(newStatus) {
  doNotDisturb = newStatus;
  updateTrayIcon();
  updateSettings({ doNotDisturb: newStatus });
}

function updateAutostartStatus(enabled) {
  autostartEnabled = enabled;

  try {
    if (process.platform === "darwin") {
      // macOS: Use Electron's built-in login item settings
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true, // Start hidden (tray only)
        path: app.getPath("exe"),
      });
    } else if (process.platform === "win32") {
      // Windows: Use Electron's built-in login item settings
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true, // Start hidden (tray only)
        path: app.getPath("exe"),
      });
    }

    // Update settings
    updateSettings({ autostartEnabled: enabled });
    console.log(`Autostart ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    console.error("Failed to update autostart settings:", error);
    // Revert the change if it failed
    autostartEnabled = !enabled;
  }
}

function getAutostartStatus() {
  try {
    if (process.platform === "darwin" || process.platform === "win32") {
      const loginItemSettings = app.getLoginItemSettings();
      return loginItemSettings.openAtLogin;
    }
    return false;
  } catch (error) {
    console.error("Failed to get autostart status:", error);
    return false;
  }
}

function scanAvailableHamsters() {
  try {
    const fs = require("fs");
    const hamstersDir = path.join(__dirname, "assets", "hamsters");

    if (!fs.existsSync(hamstersDir)) {
      availableHamsters = [];
      return;
    }

    const files = fs.readdirSync(hamstersDir);
    availableHamsters = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".gif"].includes(ext);
      })
      .map((file) => path.parse(file).name) // Remove extension
      .filter((name) => name.length > 0) // Filter out empty names
      .sort(); // Alphabetical order

    console.log(
      `Found ${availableHamsters.length} hamsters:`,
      availableHamsters
    );
  } catch (error) {
    console.error("Error scanning hamsters:", error);
    availableHamsters = [];
  }
}

function registerHotkey() {
  // First, unregister all existing shortcuts
  globalShortcut.unregisterAll();

  const bindings = [
    {
      acc: "CommandOrControl+Alt+H",
      run: () => sendHamsterUpstream("default", 1500),
    },
    { acc: "CommandOrControl+Alt+T", run: () => openToastPrompt() },
  ];

  // Add dynamic hotkeys for available hamsters (1-9, 0)
  const maxHotkeys = 10; // ⌘⌥1 to ⌘⌥0
  const hamstersToBind = availableHamsters.slice(0, maxHotkeys);

  hamstersToBind.forEach((hamster, index) => {
    const keyNumber = (index + 1) % 10; // 1,2,3,4,5,6,7,8,9,0
    const key = keyNumber === 0 ? "0" : String(keyNumber);

    bindings.push({
      acc: `CommandOrControl+Alt+${key}`,
      run: () => sendHamsterUpstream(hamster, 1500),
    });

    console.log(`Registered hotkey ⌘⌥${key} for hamster: ${hamster}`);
  });

  // Register all bindings
  for (const { acc, run } of bindings) {
    try {
      globalShortcut.register(acc, run);
    } catch (error) {
      console.error(`Failed to register hotkey ${acc}:`, error);
    }
  }
}

app.whenReady().then(() => {
  // IPC-Handler für Toast-Fenster öffnen - SOFORT registrieren
  ipcMain.removeHandler("open-toast-prompt");
  ipcMain.handle("open-toast-prompt", async (event, targetUser) => {
    console.log(`📝 open-toast-prompt IPC received: targetUser=${targetUser}`);
    try {
      openToastPrompt(targetUser);
      console.log(
        `✅ openToastPrompt called successfully with targetUser=${targetUser}`
      );
    } catch (error) {
      console.error(`❌ Failed to call openToastPrompt:`, error);
    }
  });

  createOverlayWindow();
  createTray();
  scanAvailableHamsters(); // Scan for available hamsters first
  registerHotkey(); // Then register hotkeys
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
  console.log(
    `🐹 sendHamsterUpstream: variant=${variant}, durationMs=${durationMs}`
  );

  if (ws && ws.readyState === ws.OPEN) {
    const payload = {
      type: "hamster",
      variant,
      duration: durationMs,
      sender: displayName || "unknown",
    };
    console.log(`📤 Sending hamster to server:`, payload);
    ws.send(JSON.stringify(payload));
  } else {
    console.log(
      `❌ WebSocket not ready: status=${wsStatus}, readyState=${ws?.readyState}`
    );
  }

  // Local echo for the sender
  console.log(`👁️ Showing local hamster echo`);
  showHamster(variant, durationMs, displayName);
}

function openToastPrompt(targetUser = null) {
  console.log(`📝 openToastPrompt called: targetUser=${targetUser}`);
  console.log(`🔍 targetUser type: ${typeof targetUser}, value: ${targetUser}`);

  const composeWin = new BrowserWindow({
    width: 600,
    height: 600,
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

  console.log(`📁 Loading compose.html...`);
  composeWin.loadFile(path.join(__dirname, "renderer", "compose.html"), {
    query: { sev: String(lastSeverity || "blue") },
  });

  // Event-Listener für das Laden
  composeWin.webContents.once("did-finish-load", () => {
    console.log(`🎯 Compose window finished loading`);
  });

  composeWin.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error(
        `❌ Compose window failed to load:`,
        errorCode,
        errorDescription
      );
    }
  );

  // Wenn ein Empfänger vorausgewählt ist, sende ihn nach dem Laden
  if (targetUser) {
    console.log(`🎯 Setting target user: ${targetUser}`);
    composeWin.webContents.once("did-finish-load", () => {
      try {
        // Kurze Verzögerung, um sicherzustellen, dass das DOM vollständig geladen ist
        setTimeout(() => {
          composeWin.webContents.send("set-target-user", targetUser);
          console.log(`✅ set-target-user IPC sent: ${targetUser}`);
        }, 200);
      } catch (error) {
        console.error(`❌ Failed to send set-target-user IPC:`, error);
      }
    });
  } else {
    console.log(`ℹ️ No target user specified`);
  }
  const onSubmit = (_evt, payload) => {
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
    const target = payload?.target || "all";

    if (ws && ws.readyState === ws.OPEN && message) {
      ws.send(
        JSON.stringify({
          type: "toast",
          message,
          severity,
          duration,
          target,
          sender: displayName || "unknown",
        })
      );
    }
    try {
      updateSettings({ lastSeverity: severity });
      lastSeverity = severity;
    } catch (_) {}

    // Fenster bleibt offen für weitere Toasts
    // try {
    //   composeWin.close();
    // } catch (_) {}

    // Eingabefeld leeren
    try {
      composeWin.webContents.send("clear-input");
    } catch (_) {}
  };
  const onCancel = () => {
    try {
      composeWin.close();
    } catch (_) {}
  };

  // Event-Listener registrieren
  ipcMain.on("compose-toast-submit", onSubmit);
  ipcMain.on("compose-toast-cancel", onCancel);

  // Event-Listener entfernen wenn Fenster geschlossen wird
  composeWin.on("closed", () => {
    try {
      ipcMain.removeListener("compose-toast-submit", onSubmit);
      ipcMain.removeListener("compose-toast-cancel", onCancel);
    } catch (_) {}
  });
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
  console.log(`🏗️ buildTrayMenu called`);
  if (!tray) {
    console.log(`❌ No tray available`);
    return;
  }

  // Platform-specific shortcut display
  const isMac = process.platform === "darwin";
  const cmdKey = isMac ? "⌘" : "Ctrl";

  // Get status emoji and text
  const getStatusInfo = () => {
    switch (wsStatus) {
      case "connected":
        return { emoji: "🟢", text: "Online" };
      case "connecting":
        return { emoji: "🟡", text: "Verbinde..." };
      case "disconnected":
      default:
        return { emoji: "🔴", text: "Offline" };
    }
  };

  const statusInfo = getStatusInfo();

  const template = [
    {
      label: `${statusInfo.emoji} Du bist: ${displayName || "Anonymous"} (${
        statusInfo.text
      })`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Do Not Disturb",
      type: "checkbox",
      checked: doNotDisturb,
      click: (item) => {
        updateDNDStatus(item.checked);
      },
    },
    {
      label: "Beim Login starten",
      type: "checkbox",
      checked: autostartEnabled,
      click: (item) => {
        updateAutostartStatus(item.checked);
      },
    },
    { label: "Name ändern…", click: () => openNamePrompt() },
    { type: "separator" },
    {
      label: `Self Hamster\t\t${cmdKey}⌥H`,
      click: () => {
        console.log(`🖱️ Tray menu clicked for Self Hamster`);
        showHamster("default", 1500);
      },
    },
    { type: "separator" },
    { label: "🐹 Hamster senden:", enabled: false },
    // Hamster direkt als Hauptmenü-Items statt als Submenü
    ...(availableHamsters.length > 0
      ? availableHamsters.map((hamster, index) => {
          const keyNumber = (index + 1) % 10; // 1,2,3,4,5,6,7,8,9,0
          const key = keyNumber === 0 ? "0" : String(keyNumber);
          return {
            label: `  ${hamster}\t\t${cmdKey}⌥${key}`,
            click: () => {
              console.log(`🖱️ Tray menu clicked for hamster: ${hamster}`);
              sendHamsterUpstream(hamster, 1500);
            },
          };
        })
      : [
          {
            label: "  Keine Hamster gefunden",
            enabled: false,
          },
        ]),
    { type: "separator" },
    {
      label: `Send Toast...\t\t${cmdKey}⌥T`,
      click: () => {
        console.log(`🖱️ Tray menu clicked for Send Toast`);
        openToastPrompt();
      },
    },
    { type: "separator" },
    {
      label: "🔄 Verbindung neu starten",
      click: () => reconnectWebSocket(),
      enabled: wsStatus !== "connecting",
    },
    { type: "separator" },
    { role: "quit" },
  ];
  try {
    console.log(`📋 Building menu template with ${template.length} items`);
    const menu = Menu.buildFromTemplate(template);
    tray.setContextMenu(menu);
    console.log(`✅ Tray context menu set successfully`);
    // Tooltip is now managed by updateTrayIcon()
  } catch (error) {
    console.error(`❌ Failed to set tray context menu:`, error);
  }
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
      buildTrayMenu();
      reconnectWebSocket();
      // updateServerName() wird nach dem Reconnect aufgerufen
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
    if (settings.doNotDisturb !== undefined) {
      doNotDisturb = Boolean(settings.doNotDisturb);
    }
    if (settings.autostartEnabled !== undefined) {
      autostartEnabled = Boolean(settings.autostartEnabled);
    }
  }
  if (!displayName) {
    const os = require("os");
    displayName = (os.userInfo().username || "Anonymous").slice(0, 32);
    updateSettings({ displayName });
  }

  // Synchronize autostart setting with system
  try {
    if (autostartEnabled) {
      const systemStatus = getAutostartStatus();
      if (systemStatus !== autostartEnabled) {
        // System setting doesn't match our setting, update it
        updateAutostartStatus(autostartEnabled);
      }
    }
  } catch (error) {
    console.error("Failed to sync autostart setting:", error);
  }
}

// Funktion um den aktuellen Namen an den Server zu senden
function updateServerName() {
  console.log(
    `📝 updateServerName called: ws=${!!ws}, readyState=${
      ws?.readyState
    }, displayName=${displayName}`
  );

  if (ws && ws.readyState === ws.OPEN && displayName) {
    const payload = {
      type: "update-name",
      name: displayName,
    };
    console.log(`📤 Sending update-name:`, payload);
    ws.send(JSON.stringify(payload));
    console.log(`✅ update-name sent successfully`);
  } else {
    console.log(`❌ Cannot send update-name: ws not ready or no displayName`);
  }
}

// IPC Handlers für User-Management
ipcMain.handle("load-users", async () => {
  try {
    const response = await fetch(
      `${WS_URL.replace("ws://", "http://").replace("/ws", "")}/users`
    );
    if (response.ok) {
      const data = await response.json();
      return data.users || [];
    }
    return [];
  } catch (error) {
    console.warn("Failed to load users:", error);
    return [];
  }
});

ipcMain.handle("refresh-users", async () => {
  try {
    const response = await fetch(
      `${WS_URL.replace("ws://", "http://").replace("/ws", "")}/users`
    );
    if (response.ok) {
      const data = await response.json();
      return data.users || [];
    }
    return [];
  } catch (error) {
    console.warn("Failed to refresh users:", error);
    return [];
  }
});

// Handler für aktuellen User-Namen
ipcMain.handle("get-current-user", () => {
  return displayName || "Anonymous";
});
