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
// Use built-in fetch if available (Electron 18+), fallback to node-fetch
const fetch = globalThis.fetch || require("node-fetch");

const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws";
const WS_TOKEN = process.env.WS_TOKEN || "";

let tray = null;
let overlayWindow = null;
let statusWindow = null;
let reactionWindow = null;
let userListWindow = null;
let doNotDisturb = false; // Will be loaded from settings on startup
let autostartEnabled = false; // Will be loaded from settings on startup
let ws = null;
let wsStatus = "disconnected"; // "connected", "connecting", "disconnected"
let displayName = null;
let availableHamsters = []; // Dynamically loaded hamster variants
let wsConnectToken = 0;
let lastSeverity = "blue";
let userListUpdateTimer = null; // Timer für Auto-Update der User-Liste

function createOverlayWindow() {
  console.log(`🏗️ Creating overlay window...`);

  // Erstelle zuerst das Status-Overlay (oben rechts)
  createStatusWindow();

  // Erstelle das User-List-Overlay (oben links)
  createUserListWindow();

  // Erstelle das Reaction-Overlay (unten)
  createReactionWindow();

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
  // Mouse-Events standardmäßig ignorieren (click-through), nur bei aktiven Toasts aktivieren
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.showInactive();

  console.log(`✅ Overlay window created and shown`);

  // DevTools für das Overlay-Fenster (DEAKTIVIERT für Production)
  // overlayWindow.webContents.once("did-finish-load", () => {
  //   try {
  //     overlayWindow.webContents.openDevTools({ mode: "detach" });
  //     console.log(`🔧 DevTools opened for overlay after load`);
  //   } catch (error) {
  //     console.error(`❌ Failed to open DevTools:`, error);
  //   }
  // });

  // Event-Listener für das Laden
  overlayWindow.webContents.once("did-finish-load", () => {
    console.log(`🎯 Overlay window finished loading`);
    // Repositioniere das Reaction-Window nach dem Toast-Overlay laden
    setTimeout(() => {
      positionReactionWindow();
    }, 100);
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

function createStatusWindow() {
  try {
    console.log(`🏗️ Creating status window...`);

    statusWindow = new BrowserWindow({
      width: 350,
      height: 80, // Viel kleiner - nur für eine Status-Nachricht
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
        preload: path.join(__dirname, "preload_status.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    console.log(`📁 Loading status.html...`);
    statusWindow.loadFile(path.join(__dirname, "renderer", "status.html"));

    statusWindow.setAlwaysOnTop(true, "screen-saver");
    statusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    statusWindow.setIgnoreMouseEvents(true);
    statusWindow.showInactive();

    // Positioniere das Status-Overlay oben rechts
    positionStatusWindow();

    // DevTools für das Status-Fenster deaktiviert
    // if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    //   statusWindow.webContents.openDevTools({ mode: "detach" });
    // }

    console.log(`✅ Status window created and shown`);

    // Event-Listener für das Laden
    statusWindow.webContents.once("did-finish-load", () => {
      console.log(`🎯 Status window finished loading`);

      // Repositioniere das Toast-Overlay, damit es unter dem Status-Overlay ist
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        console.log(`🔧 Repositioning toast overlay below status`);
        positionOverlayTopRight();
      }
    });

    statusWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error(
          `❌ Status window failed to load:`,
          errorCode,
          errorDescription
        );
      }
    );

    console.log(`✅ Status window created successfully`);
  } catch (error) {
    console.error(`❌ Error creating status window:`, error);
    statusWindow = null;
  }
}

function createReactionWindow() {
  try {
    console.log(`🏗️ Creating reaction window...`);

    reactionWindow = new BrowserWindow({
      width: 400,
      height: 150,
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
        preload: path.join(__dirname, "preload_reaction.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    console.log(`📁 Loading reaction.html...`);
    reactionWindow.loadFile(path.join(__dirname, "renderer", "reaction.html"));

    reactionWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    reactionWindow.setIgnoreMouseEvents(true);
    reactionWindow.showInactive();

    // Positioniere das Reaction-Overlay unten rechts
    positionReactionWindow();

    console.log(`✅ Reaction window created and shown`);

    // Event-Listener für das Laden
    reactionWindow.webContents.once("did-finish-load", () => {
      console.log(`🎯 Reaction window finished loading`);
      // Repositioniere das Reaction-Window nach dem Laden
      setTimeout(() => {
        positionReactionWindow();
      }, 100);
    });

    reactionWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error(
          `❌ Reaction window failed to load: ${errorCode} - ${errorDescription}`
        );
      }
    );

    console.log(`✅ Reaction window created successfully`);
  } catch (error) {
    console.error(`❌ Error creating reaction window:`, error);
    reactionWindow = null;
  }
}

function positionStatusWindow() {
  if (!statusWindow || statusWindow.isDestroyed()) return;
  const margin = 20;
  const currentBounds = statusWindow.getBounds();

  // Verwende den gleichen Monitor wie das Overlay-Fenster
  let target = screen.getPrimaryDisplay();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const overlayBounds = overlayWindow.getBounds();
    const overlayCenter = {
      x: overlayBounds.x + overlayBounds.width / 2,
      y: overlayBounds.y + overlayBounds.height / 2,
    };
    target = screen.getDisplayNearestPoint(overlayCenter) || target;
    console.log(`🔧 Using same display as overlay window`);
  } else {
    try {
      const pt = screen.getCursorScreenPoint();
      target = screen.getDisplayNearestPoint(pt) || target;
    } catch (_) {}
  }

  const work = target.workArea;
  const x = Math.floor(work.x + work.width - currentBounds.width - margin);
  const y = Math.floor(work.y + margin); // Status-Overlay ganz oben

  console.log(`🔧 Status window positioned at top: x=${x}, y=${y}`);
  statusWindow.setPosition(x, y);
}

function positionReactionWindow() {
  if (!reactionWindow || reactionWindow.isDestroyed()) return;
  const margin = 20;
  const gap = 10;
  const currentBounds = reactionWindow.getBounds();

  // Verwende den gleichen Monitor wie das Overlay-Fenster
  let target = screen.getPrimaryDisplay();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const overlayBounds = overlayWindow.getBounds();
    const overlayCenter = {
      x: overlayBounds.x + overlayBounds.width / 2,
      y: overlayBounds.y + overlayBounds.height / 2,
    };
    target = screen.getDisplayNearestPoint(overlayCenter) || target;
  } else {
    try {
      const pt = screen.getCursorScreenPoint();
      target = screen.getDisplayNearestPoint(pt) || target;
    } catch (_) {}
  }

  const work = target.workArea;
  const x = Math.floor(work.x + work.width - currentBounds.width - margin);

  // Reaction-Overlay ganz unten positionieren (unter Toast-Overlay)
  let y = Math.floor(work.y + margin);

  // Wenn Status-Overlay und Toast-Overlay existieren, positioniere Reaction darunter
  if (
    statusWindow &&
    !statusWindow.isDestroyed() &&
    overlayWindow &&
    !overlayWindow.isDestroyed()
  ) {
    const statusBounds = statusWindow.getBounds();
    const overlayBounds = overlayWindow.getBounds();
    const totalHeight = statusBounds.height + overlayBounds.height + gap * 2;
    y = Math.floor(work.y + margin + totalHeight + gap);
    console.log(`🔧 Reaction positioned below overlays: y=${y}`);
  }

  reactionWindow.setPosition(x, y);
}

function createUserListWindow() {
  try {
    console.log(`🏗️ Creating user list window...`);

    userListWindow = new BrowserWindow({
      width: 280,
      height: 200,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      fullscreenable: false,
      hasShadow: false,
      show: false, // Initially hidden
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload_userlist.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    console.log(`📁 Loading userlist.html...`);
    userListWindow.loadFile(path.join(__dirname, "renderer", "userlist.html"));

    userListWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    userListWindow.setIgnoreMouseEvents(false); // Buttons müssen klickbar sein

    // Positioniere das User-List-Overlay links oben
    positionUserListWindow();

    console.log(`✅ User list window created`);

    // Event-Listener für das Laden
    userListWindow.webContents.once("did-finish-load", () => {
      console.log(`🎯 User list window finished loading`);
    });

    userListWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error(
          `❌ User list window failed to load: ${errorCode} - ${errorDescription}`
        );
      }
    );

    console.log(`✅ User list window created successfully`);
  } catch (error) {
    console.error(`❌ Error creating user list window:`, error);
    userListWindow = null;
  }
}

function positionUserListWindow() {
  if (!userListWindow || userListWindow.isDestroyed()) return;
  const margin = 20;
  const currentBounds = userListWindow.getBounds();

  // Verwende den gleichen Monitor wie das Status-Fenster
  let target = screen.getPrimaryDisplay();
  if (statusWindow && !statusWindow.isDestroyed()) {
    const statusBounds = statusWindow.getBounds();
    const statusCenter = {
      x: statusBounds.x + statusBounds.width / 2,
      y: statusBounds.y + statusBounds.height / 2,
    };
    target = screen.getDisplayNearestPoint(statusCenter) || target;
  } else {
    try {
      const pt = screen.getCursorScreenPoint();
      target = screen.getDisplayNearestPoint(pt) || target;
    } catch (_) {}
  }

  const work = target.workArea;
  const x = Math.floor(work.x + margin); // Links positionieren
  const y = Math.floor(work.y + margin); // Oben positionieren

  console.log(`🔧 User list positioned at top left: x=${x}, y=${y}`);
  userListWindow.setPosition(x, y);
}

function positionOverlayTopRight() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const margin = 20;
  const gap = 10; // Abstand zwischen Status und Toast
  const currentBounds = overlayWindow.getBounds();

  let target = screen.getPrimaryDisplay();
  try {
    const pt = screen.getCursorScreenPoint();
    target = screen.getDisplayNearestPoint(pt) || target;
  } catch (_) {}

  const work = target.workArea;
  const x = Math.floor(work.x + work.width - currentBounds.width - margin);

  // Toast-Overlay unter dem Status-Overlay positionieren
  let y = Math.floor(work.y + margin);

  // Wenn Status-Overlay existiert, positioniere Toast darunter
  if (statusWindow && !statusWindow.isDestroyed()) {
    const statusBounds = statusWindow.getBounds();
    const statusHeight = statusBounds.height;
    y = Math.floor(work.y + margin + statusHeight + gap);
    console.log(
      `🔧 Toast positioned below status: statusHeight=${statusHeight}, y=${y}`
    );
  } else {
    console.log(`🔧 Toast positioned at top (no status): y=${y}`);
  }

  overlayWindow.setPosition(x, y);
}

async function showHamster(variant, durationMs, sender) {
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

    // Fetch image as data URL to completely bypass CORS
    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const imageUrl = `${serverUrl}/api/hamsters/${variant}/image`;
    console.log(`🔗 Fetching image from: ${imageUrl}`);
    console.log(`🔍 Variant requested: ${variant}`);
    console.log(`⏰ Duration: ${durationMs}ms`);

    let finalImageUrl = null;

    try {
      // Import node-fetch
      const fetch = require("node-fetch");
      console.log(`📡 Fetching image via node-fetch...`);

      const response = await fetch(imageUrl);
      if (response.ok) {
        const buffer = await response.buffer();
        const base64 = buffer.toString("base64");
        finalImageUrl = `data:image/png;base64,${base64}`;
        console.log(`✅ Image converted to data URL (${buffer.length} bytes)`);
      } else {
        console.error(
          `❌ Failed to fetch image: ${response.status} ${response.statusText}`
        );
        finalImageUrl = null; // Will use placeholder
      }
    } catch (error) {
      console.error(`❌ Failed to fetch/convert image:`, error.message);
      finalImageUrl = null; // Will use placeholder
    }

    const payload = {
      variant,
      durationMs,
      url: finalImageUrl, // null = use placeholder
      sender,
    };
    console.log(
      `📤 Sending show-hamster IPC with ${
        finalImageUrl ? "data URL" : "placeholder"
      }`
    );

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

function showToast(
  message,
  severity,
  durationMs,
  sender,
  recipientInfo,
  senderId
) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlayTopRight();

  // Mouse-Events aktivieren wenn Toast angezeigt wird (für Buttons)
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.webContents.send("show-toast", {
    message,
    severity,
    durationMs,
    sender,
    recipientInfo,
    senderId,
  });
}

// Funktion um Mouse-Events wieder zu deaktivieren wenn keine Toasts mehr da sind
function disableOverlayMouseEvents() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  console.log(`🖱️ Disabling overlay mouse events (click-through enabled)`);
  overlayWindow.setIgnoreMouseEvents(true);
}

function showSuccessMessage(target) {
  console.log(`🔍 showSuccessMessage called with target: ${target}`);

  if (!statusWindow || statusWindow.isDestroyed()) {
    console.log(`❌ Status window not available`);
    return;
  }

  console.log(`🔍 Status window state:`, {
    isDestroyed: statusWindow.isDestroyed(),
    isVisible: statusWindow.isVisible(),
    webContents: !!statusWindow.webContents,
  });

  // Empfänger-Text generieren
  let recipientText = "alle";
  if (target && target !== "all") {
    // Falls es eine UUID ist, extrahiere den Namen
    if (target.includes("-::ffff:")) {
      recipientText = target.split("-::ffff:")[0];
    } else {
      recipientText = target;
    }
  }

  console.log(`📤 Sending status message to: ${recipientText}`);

  try {
    statusWindow.webContents.send("show-status", {
      type: "success",
      message: `Nachricht erfolgreich gesendet an "${recipientText}"`,
      durationMs: 4000,
    });
    console.log(`✅ Status message sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending status message:`, error);
  }

  console.log(`✅ Success message shown: sent to ${recipientText}`);
}

function showUserStatusMessage(user, status, message) {
  console.log(`👤 showUserStatusMessage called: ${user} is ${status}`);

  if (!statusWindow || statusWindow.isDestroyed()) {
    console.error(`❌ Status window not available for user status`);
    return;
  }

  try {
    const statusType = status === "online" ? "info" : "warning";
    statusWindow.webContents.send("show-status", {
      type: statusType,
      message: message,
      durationMs: 3000, // Etwas kürzer für Status-Nachrichten
    });
    console.log(`✅ User status message sent: ${user} ${status}`);
  } catch (error) {
    console.error(`❌ Error sending user status message:`, error);
  }
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
            event.recipientInfo,
            event.senderId
          );
        } else if (event.type === "user-status") {
          console.log(`👤 User status: ${event.user} is ${event.status}`);
          showUserStatusMessage(event.user, event.status, event.message);
        } else if (event.type === "reaction") {
          console.log(
            `💖 Reaction received: ${event.reaction} from ${event.fromUser}`
          );
          showReactionFeedback(event.fromUser, event.reaction);
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

async function loadHamstersFromServer() {
  try {
    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const response = await fetch(`${serverUrl}/api/hamsters`);

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    availableHamsters = data.hamsters.map((hamster) => hamster.id);

    console.log(
      `🐹 Loaded ${availableHamsters.length} hamsters from server:`,
      availableHamsters
    );

    return data.hamsters;
  } catch (error) {
    console.error("❌ Error loading hamsters from server:", error);

    // Fallback: Try local assets as backup
    try {
      console.log("🔄 Falling back to local hamster assets...");
      await scanLocalHamsters();
    } catch (fallbackError) {
      console.error("❌ Local fallback also failed:", fallbackError);
      availableHamsters = [];
    }

    return [];
  }
}

async function scanLocalHamsters() {
  const fs = require("fs");

  // Try different paths for development vs production
  let hamstersDir = path.join(__dirname, "assets", "hamsters");

  // If not found, try resources path (production build)
  if (!fs.existsSync(hamstersDir)) {
    hamstersDir = path.join(process.resourcesPath, "assets", "hamsters");
  }

  // If still not found, try current working directory
  if (!fs.existsSync(hamstersDir)) {
    hamstersDir = path.join(process.cwd(), "assets", "hamsters");
  }

  if (!fs.existsSync(hamstersDir)) {
    console.log("❌ Hamsters directory not found in any location");
    availableHamsters = [];
    return;
  }

  console.log(`🔍 Found local hamsters directory: ${hamstersDir}`);

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
    `🔄 Found ${availableHamsters.length} local hamsters:`,
    availableHamsters
  );
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

  // DevTools Hotkey für Overlay (DEAKTIVIERT für Production)
  // bindings.push({
  //   acc: "CommandOrControl+Shift+I",
  //   run: () => {
  //     console.log(`🔧 DevTools hotkey pressed`);
  //     if (overlayWindow && !overlayWindow.isDestroyed()) {
  //       overlayWindow.webContents.openDevTools({ mode: "detach" });
  //     }
  //   },
  // });

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

  // IPC-Handler um Mouse-Events zu deaktivieren wenn keine Toasts mehr da sind
  ipcMain.handle("disable-overlay-mouse-events", async () => {
    disableOverlayMouseEvents();
  });

  createOverlayWindow();
  createTray();

  // Load hamsters asynchronously, then register hotkeys and build tray
  loadHamstersFromServer()
    .then(() => {
      registerHotkey(); // Register hotkeys after hamsters are loaded
      return ensureDisplayName();
    })
    .then(() => {
      connectWebSocket();
      buildTrayMenu();
    })
    .catch((error) => {
      console.error("❌ Failed to initialize hamsters:", error);
      // Continue with app initialization even if hamsters fail
      registerHotkey(); // Register with empty hamsters
      ensureDisplayName().then(() => {
        connectWebSocket();
        buildTrayMenu();
      });
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
    height: 700, // Höher für Windows
    resizable: true,
    modal: true,
    frame: true,
    alwaysOnTop: true,
    transparent: true, // Für Glaseffekt!
    backgroundColor: "#00000000", // Vollständig transparent
    webPreferences: {
      preload: path.join(__dirname, "preload_compose.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log(`📁 Loading compose.html...`);
  // URL-Parameter für targetUser hinzufügen
  const queryParams = { sev: String(lastSeverity || "blue") };
  if (targetUser) {
    queryParams.target = targetUser;
  }

  composeWin.loadFile(path.join(__dirname, "renderer", "compose.html"), {
    query: queryParams,
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
    const duration = 3000; // Fixed duration (not used anymore since toasts are permanent)
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

      // Bestätigung anzeigen - mit kurzer Verzögerung damit das Overlay bereit ist
      setTimeout(() => {
        showSuccessMessage(target);
      }, 100);
    } else if (message) {
      // HTTP-Fallback
      console.log(`❌ WebSocket not ready, using HTTP fallback`);
      // Hier könnte man HTTP-Fallback implementieren

      // Trotzdem Erfolgsmeldung anzeigen
      setTimeout(() => {
        showSuccessMessage(target);
      }, 100);
    }
    try {
      updateSettings({ lastSeverity: severity });
      lastSeverity = severity;
    } catch (_) {}

    // Fenster schließen nach dem Senden
    try {
      composeWin.close();
    } catch (_) {}

    // Eingabefeld leeren (falls das Fenster doch offen bleibt)
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
    // User Info with Status
    {
      label: `${statusInfo.emoji} Your name: ${displayName || "Anonymous"} (${
        statusInfo.text
      })`,
      enabled: false,
    },
    { label: "✏️ Change Name", click: () => openNamePrompt() },
    {
      label: "🔄 Reconnect",
      click: () => reconnectWebSocket(),
      enabled: wsStatus !== "connecting",
    },
    { type: "separator" },

    // Do Not Disturb
    {
      label: "🔕 Do Not Disturb",
      type: "checkbox",
      checked: doNotDisturb,
      click: (item) => {
        updateDNDStatus(item.checked);
      },
    },
    { type: "separator" },

    // Autostart
    {
      label: "🚀 Autostart",
      type: "checkbox",
      checked: autostartEnabled,
      click: (item) => {
        updateAutostartStatus(item.checked);
      },
    },
    { type: "separator" },

    // Hamsters (Self Hamster entfernt!)
    { label: "🐹 Send hamster:", enabled: false },
    // Hamster direkt als Hauptmenü-Items
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
            label: "  No hamsters found",
            enabled: false,
          },
        ]),
    { type: "separator" },

    // Send Toast
    {
      label: `💬 Send Toast...\t\t${cmdKey}⌥T`,
      click: () => {
        console.log(`🖱️ Tray menu clicked for Send Toast`);
        openToastPrompt();
      },
    },
    { type: "separator" },

    // Show Online Users
    {
      label: `👥 Show Online Users`,
      click: () => {
        console.log(`🖱️ Tray menu clicked for Show Online Users`);
        showOnlineUsers();
      },
    },
    { type: "separator" },

    // About/Version
    {
      label: "ℹ️ About Shoutout",
      click: () => {
        console.log(`🖱️ Tray menu clicked for About`);
        showAboutWindow();
      },
    },
    { type: "separator" },

    // Quit
    { label: "❌ Quit", role: "quit" },
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

function showAboutWindow() {
  const aboutWin = new BrowserWindow({
    width: 650,
    height: 900,
    resizable: false,
    modal: true,
    frame: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload_about.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  aboutWin.loadFile(path.join(__dirname, "renderer", "about.html"));

  // Handle close
  aboutWin.on("closed", () => {
    // Cleanup if needed
  });
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

// IPC Handler für send-reaction
ipcMain.handle("send-reaction", async (event, { targetUserId, reaction }) => {
  console.log(`💖 send-reaction IPC received:`, { targetUserId, reaction });
  try {
    sendReactionToServer(targetUserId, reaction);
    console.log(`✅ Reaction sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending reaction:`, error);
  }
});

// Funktion zum Senden von Reactions an den Server
function sendReactionToServer(targetUserId, reaction) {
  console.log(`💖 sendReactionToServer:`, { targetUserId, reaction });

  if (ws && ws.readyState === ws.OPEN) {
    const payload = {
      type: "reaction",
      targetUserId: targetUserId,
      reaction: reaction,
      fromUser: displayName || "Anonymous",
    };
    console.log(`📤 Sending reaction to server:`, payload);
    ws.send(JSON.stringify(payload));
  } else {
    console.error(`❌ WebSocket not ready for reaction`);
  }
}

// Funktion zum Anzeigen von Reactions
function showReactionFeedback(fromUser, reaction) {
  console.log(`💖 showReactionFeedback:`, { fromUser, reaction });

  if (!reactionWindow || reactionWindow.isDestroyed()) {
    console.error(`❌ Reaction window not available`);
    return;
  }

  try {
    reactionWindow.webContents.send("show-reaction", {
      fromUser: fromUser,
      reaction: reaction,
      durationMs: 5000,
    });
    console.log(`✅ Reaction feedback sent to overlay`);
  } catch (error) {
    console.error(`❌ Error sending reaction feedback:`, error);
  }
}

// Funktion zum Anzeigen der Online-Users
async function fetchOnlineUsers() {
  if (!userListWindow || userListWindow.isDestroyed()) {
    return null;
  }

  try {
    // Hole aktuelle User-Liste vom Server
    const response = await fetch(
      `${WS_URL.replace("ws://", "http://").replace("/ws", "")}/users`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();

    // Konvertiere zu User-Liste mit Status
    const users = data.users.map((user) => ({
      name: user.name || user.displayName || "Unknown",
      status: "online", // Alle sind online, da vom Server geholt
      id: user.id || user.name,
    }));

    return users;
  } catch (error) {
    console.error(`❌ Error fetching online users:`, error);
    return [];
  }
}

async function showOnlineUsers() {
  console.log(`👥 showOnlineUsers called`);

  if (!userListWindow || userListWindow.isDestroyed()) {
    console.error(`❌ User list window not available`);
    return;
  }

  const users = await fetchOnlineUsers();
  if (users === null) return;

  console.log(`📋 Fetched users:`, users);

  // Zeige User-Liste an
  userListWindow.showInactive();
  userListWindow.webContents.send("show-userlist", {
    users: users,
    durationMs: 15000,
  });

  console.log(`✅ Online users sent to overlay: ${users.length} users`);

  // TODO: Auto-Update Timer (auskommentiert - war wahrscheinlich überflüssig da Liste nur 15s sichtbar)
  // startUserListAutoUpdate();
}

// TODO: Auto-Update Funktionen (auskommentiert - für später falls benötigt)
/*
function startUserListAutoUpdate() {
  // Stoppe vorherigen Timer falls vorhanden
  if (userListUpdateTimer) {
    clearInterval(userListUpdateTimer);
  }

  console.log(`⏰ Starting user list auto-update (every 30 seconds)`);

  userListUpdateTimer = setInterval(async () => {
    // Prüfe ob User-Liste noch sichtbar ist
    if (
      !userListWindow ||
      userListWindow.isDestroyed() ||
      !userListWindow.isVisible()
    ) {
      console.log(`⏰ User list not visible - stopping auto-update`);
      stopUserListAutoUpdate();
      return;
    }

    console.log(`🔄 Auto-updating user list...`);
    const users = await fetchOnlineUsers();

    if (users !== null && userListWindow && !userListWindow.isDestroyed()) {
      // Update die Liste ohne sie neu zu zeigen
      userListWindow.webContents.send("update-userlist", {
        users: users,
      });
      console.log(`✅ User list auto-updated: ${users.length} users`);
    }
  }, 30000); // 30 Sekunden
}

function stopUserListAutoUpdate() {
  if (userListUpdateTimer) {
    console.log(`⏰ Stopping user list auto-update`);
    clearInterval(userListUpdateTimer);
    userListUpdateTimer = null;
  }
}
*/
