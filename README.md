# Shoutout - Hamster & Toast System

## 🎯 Projektübersicht

Ein Desktop-Notification-System mit Hamster-Overlays und Toast-Nachrichten, das über WebSocket-Hub, Discord-Bot und lokale Hotkeys gesteuert werden kann.

## 🏗️ Architektur

### Client (Electron App)

- **Hauptprozess**: `client/main.js` - Tray, Overlay-Fenster, WebSocket-Client
- **Renderer**: `client/renderer/` - HTML/CSS/JS für Overlays
- **Preloads**: Sichere IPC-Bridge zwischen Main und Renderer
- **Assets**: Icons, Hamster-Bilder, Tray-Symbole

### Server (WebSocket Hub)

- **Port**: 3001 (konfigurierbar via `PORT`)
- **Endpoints**: `/broadcast` (HTTP), `/ws` (WebSocket)
- **Features**: Rate-Limiting, Joi-Validierung, Target-Filtering

### Discord Bot

- **Commands**: `/hamster`, `/toast` mit Slash-Command-API
- **Integration**: Sendet Events an den WebSocket-Hub

## 🔧 Aktueller Stand (August 2025)

### ✅ Funktional

- **Tray-Icon**: macOS-kompatibel mit 1x/2x-Skalierung (18px/36px)
- **Overlay-System**: Transparente Fenster, immer im Vordergrund, maus-durchlässig
- **Hamster-Queue**: Verhindert Überflutung, SVG-Fallback bei fehlenden Bildern
- **Toast-System**: Verschiedene Severity-Level, Auto-Expire, Max-Stack
- **Hotkeys**: Cmd+Alt+H (Hamster), Cmd+Alt+T (Toast), Cmd+Alt+1/2 (Spezielle Hamster)
- **WebSocket**: Auto-Reconnect, Rate-Limiting, Target-Filtering
- **Einstellungen**: Persistente `displayName` und `lastSeverity` in `shoutout-user.json`
- **Autostart**: "Beim Login starten" Toggle für macOS und Windows

### 🎨 UI/UX

- **Design**: Dark Mode, moderne Buttons, Emoji-Picker
- **Responsive**: Overlay positioniert sich automatisch (oben-rechts)
- **Accessibility**: CSP-konform, ARIA-Labels, Keyboard-Navigation

### 🔒 Sicherheit

- **Context Isolation**: Aktiv in allen Electron-Fenstern
- **CSP**: Strikte Content-Security-Policy
- **Rate-Limiting**: 10 Events/10s für Broadcast, 5 Events/10s pro WS-Connection
- **Auth**: Bearer-Token für Broadcast-Endpoint

## 📁 Dateistruktur

```
_PROJEKT_shoutout/
├── client/                    # Electron Desktop App
│   ├── main.js               # Hauptprozess (Tray, Overlay, WS-Client)
│   ├── preload.js            # IPC-Bridge für Overlay
│   ├── preload_compose.js    # IPC-Bridge für Toast-Compose
│   ├── preload_name.js       # IPC-Bridge für Name-Änderung
│   ├── renderer/             # UI-Komponenten
│   │   ├── overlay.html      # Haupt-Overlay (Hamster + Toast)
│   │   ├── overlay.js        # Overlay-Logic (Queue, Animation)
│   │   ├── compose.html      # Toast-Erstellung
│   │   ├── name.html         # Name-Änderung
│   │   └── style.css         # Styling für Overlays
│   └── assets/               # Bilder und Icons
│       ├── icon/             # Tray-Icons
│       │   ├── hamster.png   # Haupt-Tray-Icon (1024x1024)
│       │   ├── hamster.ico   # Windows-Tray-Icon
│       │   ├── icon.png      # Fallback-Icon
│       │   └── icon.ico      # Windows-Fallback
│       └── hamsters/         # Hamster-Varianten
│           ├── caprisun.png  # Spezielle Hamster-Variante
│           └── lol.png       # Spezielle Hamster-Variante
├── server/                    # WebSocket Hub
│   ├── src/index.js          # Express + WS Server
│   └── package.json          # Dependencies
├── bot/                       # Discord Bot
│   ├── src/index.js          # Bot-Logic + Commands
│   ├── src/registerCommands.js # Command-Registration
│   └── package.json          # Dependencies
└── package.json               # Root-Package (veraltet)
```

## 🚀 Nächste Schritte & Verbesserungen

### Priorität 1 (Sofort umsetzbar)

1. **DND-Icon-Switching**: Beim Umschalten "Do Not Disturb" das Tray-Icon auf gedimmte Version ändern
2. **Dynamische Hamster-Liste**: `assets/hamsters/` scannen und automatisch ins Tray-Menü übernehmen
3. **WS-Status im Tooltip**: Online/Offline-Status anzeigen, Reconnect-Button im Tray

### Priorität 2 (Nächste Session)

1. **App-Icon**: Neues Hamster-Branding als macOS-App-Icon (build.mac.icon)
2. **Hamster-Animationen**: Mehr Animationen, Sound-Effekte
3. **Toast-Templates**: Vordefinierte Toast-Nachrichten

### Priorität 3 (Langfristig)

1. **Multi-Monitor**: Overlay-Position auf allen Monitoren
2. **Custom Themes**: Benutzerdefinierte Farbschemata
3. **Plugin-System**: Erweiterbare Hamster/Toast-Typen
4. **Mobile App**: Companion-App für iOS/Android

## 🔧 Technische Details

### Tray-Icon-Handling (macOS)

```javascript
// Korrekte 1x/2x-Skalierung für macOS
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
```

### WebSocket-Event-Struktur

```javascript
// Hamster Event
{
  type: "hamster",
  variant: "default" | "caprisun" | "lol",
  duration: 3000, // ms
  target: "username", // optional
  sender: "username" // wird vom Hub hinzugefügt
}

// Toast Event
{
  type: "toast",
  message: "Nachricht (max 280 Zeichen)",
  severity: "blue" | "green" | "pink" | "red" | "info" | "success" | "warn" | "critical",
  duration: 4000, // ms
  target: "username", // optional
  sender: "username" // wird vom Hub hinzugefügt
}
```

### Einstellungen (shoutout-user.json)

```json
{
  "displayName": "Benutzername",
  "lastSeverity": "blue",
  "doNotDisturb": false,
  "autostartEnabled": false
}
```

### Autostart-Funktionalität

```javascript
// Plattformübergreifende Autostart-Implementierung
function updateAutostartStatus(enabled) {
  if (process.platform === "darwin" || process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true, // Startet versteckt (nur Tray)
      path: app.getPath("exe")
    });
  }
}

// Tray-Menü Toggle
{
  label: "Beim Login starten",
  type: "checkbox",
  checked: autostartEnabled,
  click: (item) => updateAutostartStatus(item.checked)
}
```

## 🚨 Bekannte Probleme & Lösungen

### Tray-Icon wird nicht angezeigt (macOS)

- **Ursache**: Große PNGs (1024x1024) werden nicht automatisch skaliert
- **Lösung**: ✅ Bereits implementiert - explizite 1x/2x-Skalierung
- **Fallback**: Verwendet `icon.png` falls `hamster.png` fehlt

### WebSocket-Verbindung bricht ab

- **Ursache**: Netzwerk-Instabilität, Server-Neustart
- **Lösung**: ✅ Auto-Reconnect alle 2 Sekunden
- **Verbesserung**: Status im Tray anzeigen

### Overlay wird nicht angezeigt

- **Ursache**: Fenster ist hinter anderen Apps
- **Lösung**: ✅ `alwaysOnTop: true`, `setAlwaysOnTop(true, "screen-saver")`
- **Zusätzlich**: `setVisibleOnAllWorkspaces(true)`

## 📋 Environment Variables

### Client (.env)

```bash
WS_URL=ws://localhost:3001/ws
WS_TOKEN=optional-auth-token
```

### Server (.env)

```bash
PORT=3001
BROADCAST_SECRET=change-me
ALLOW_NO_AUTH=false
```

### Bot (.env)

```bash
DISCORD_TOKEN=your-bot-token
GUILD_ID=optional-guild-id
HUB_URL=http://localhost:3001
HUB_SECRET=change-me
```

## 🎮 Verwendung

### Lokale Hotkeys

- `Cmd+Alt+H`: Zeigt Hamster-Overlay
- `Cmd+Alt+T`: Öffnet Toast-Compose
- `Cmd+Alt+1`: Sendet "caprisun" Hamster
- `Cmd+Alt+2`: Sendet "lol" Hamster

### Discord Commands

- `/hamster [variant] [duration] [target]`
- `/toast [message] [severity] [duration] [target]`

### HTTP API

```bash
curl -X POST http://localhost:3001/broadcast \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"type":"hamster","variant":"default","duration":3000}'
```

## 🔄 Entwicklung

### Start der Komponenten

```bash
# Terminal 1: WebSocket Hub
cd server && npm start

# Terminal 2: Discord Bot
cd bot && npm start

# Terminal 3: Desktop Client
cd client && npm start
```

### Build

```bash
cd client && npm run build
```

## 💡 Architektur-Entscheidungen

### Warum Electron?

- **Cross-Platform**: Windows, macOS, Linux
- **Native Integration**: Tray, Hotkeys, Always-on-Top
- **Web Technologies**: Bekannte HTML/CSS/JS-Stack

### Warum WebSocket Hub?

- **Decoupling**: Client, Bot und andere Tools können unabhängig kommunizieren
- **Scalability**: Mehrere Clients können gleichzeitig verbunden sein
- **Reliability**: Auto-Reconnect, Rate-Limiting, Target-Filtering

### Warum Joi-Validierung?

- **Security**: Verhindert malformed Events
- **Consistency**: Einheitliche Event-Struktur
- **Debugging**: Klare Fehlermeldungen bei ungültigen Daten

---

**Letzte Aktualisierung**: August 2025
**Status**: Funktional, bereit für Verbesserungen  
**Nächste Session**: DND-Icon-Switching + dynamische Hamster-Liste implementieren
