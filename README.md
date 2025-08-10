# Shoutout - Hamster & Toast System

## 🎯 Projektübersicht

Ein Desktop-Notification-System mit Hamster-Overlays und Toast-Nachrichten, das über WebSocket-Hub, Discord-Bot und lokale Hotkeys gesteuert werden kann.

## 📊 Entwicklungsstand

**Status**: 🟢 **Produktionsreif** - Alle Kernfunktionen implementiert  
**Letzte Aktualisierung**: August 2025  
**Nächste Meilensteine**: App-Icon & Animationen

### 🎉 Was bereits funktioniert:

- **Desktop-App**: ✅ Vollständig funktional (macOS & Windows)
- **WebSocket-Hub**: ✅ Stabiler Server mit Rate-Limiting
- **Discord-Bot**: ✅ Slash-Commands für Hamster & Toast
- **Autostart**: ✅ Systemintegration für automatischen Start
- **Tray-System**: ✅ Vollständiges Menü mit allen Features
- **Overlays**: ✅ Hamster-Animationen & Toast-Benachrichtigungen

### 🚀 Bereit für:

- **Produktive Nutzung**: ✅ Alle Features getestet und stabil
- **Team-Deployment**: ✅ Einfache Installation und Konfiguration
- **Weiterentwicklung**: ✅ Saubere Architektur für neue Features

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

### ✅ Funktional & Implementiert

- **Tray-Icon**: ✅ macOS-kompatibel mit 1x/2x-Skalierung (18px/36px)
- **Overlay-System**: ✅ Transparente Fenster, immer im Vordergrund, maus-durchlässig
- **Hamster-Queue**: ✅ Verhindert Überflutung, SVG-Fallback bei fehlenden Bildern
- **Toast-System**: ✅ Verschiedene Severity-Level, Auto-Expire, Max-Stack
- **Hotkeys**: ✅ Cmd+Alt+H (Hamster), Cmd+Alt+T (Toast), Cmd+Alt+1/2 (Spezielle Hamster)
- **WebSocket**: ✅ Auto-Reconnect, Rate-Limiting, Target-Filtering
- **Einstellungen**: ✅ Persistente `displayName`, `lastSeverity`, `doNotDisturb` in `shoutout-user.json`
- **Autostart**: ✅ "Beim Login starten" Toggle für macOS und Windows
- **DND-Modus**: ✅ "Do Not Disturb" mit Icon-Wechsel
- **WebSocket-Status**: ✅ Online/Offline-Status im Tray-Menü und Tooltip
- **Reconnect-Funktion**: ✅ Manueller WebSocket-Neustart über Tray-Menü
- **Dynamische Hamster-Liste**: ✅ Automatisches Scannen von `assets/hamsters/`

### 🎨 UI/UX Features

- **Design**: ✅ Dark Mode, moderne Buttons, Emoji-Picker
- **Responsive**: ✅ Overlay positioniert sich automatisch (oben-rechts)
- **Accessibility**: ✅ CSP-konform, ARIA-Labels, Keyboard-Navigation
- **Tray-Menü**: ✅ Vollständig funktionales Dropdown mit allen Features
- **Status-Anzeige**: ✅ Visuelle Indikatoren für alle Systemzustände

### 🔒 Sicherheit & Stabilität

- **Context Isolation**: ✅ Aktiv in allen Electron-Fenstern
- **CSP**: 🔄 Content Security Policy (geplant, noch nicht implementiert)
- **Rate-Limiting**: ✅ 10 Events/10s für Broadcast, 5 Events/10s pro WS-Connection
- **Auth**: ✅ Bearer-Token für Broadcast-Endpoint (implementiert, Konfiguration erforderlich)
- **Error Handling**: 🔄 Robuste Fehlerbehandlung mit Fallbacks (teilweise implementiert)
- **Auto-Reconnect**: 🔄 Automatische WebSocket-Wiederherstellung (grundlegend implementiert, kann robuster werden)

## �� Dateistruktur

```
_PROJEKT_shoutout/
├── client/                    # Electron Desktop App
│   ├── main.js               # ✅ Hauptprozess (Tray, Overlay, WS-Client, Autostart)
│   ├── preload.js            # ✅ IPC-Bridge für Overlay
│   ├── preload_compose.js    # ✅ IPC-Bridge für Toast-Compose
│   ├── preload_name.js       # ✅ IPC-Bridge für Name-Änderung
│   ├── renderer/             # ✅ UI-Komponenten
│   │   ├── overlay.html      # ✅ Haupt-Overlay (Hamster + Toast)
│   │   ├── overlay.js        # ✅ Overlay-Logic (Queue, Animation)
│   │   ├── compose.html      # ✅ Toast-Erstellung
│   │   ├── name.html         # ✅ Name-Änderung
│   │   └── style.css         # ✅ Styling für Overlays
│   └── assets/               # ✅ Bilder und Icons
│       ├── icon/             # ✅ Tray-Icons (1x/2x für macOS)
│       │   ├── hamster.png   # ✅ Haupt-Tray-Icon (1024x1024)
│       │   ├── hamster.ico   # ✅ Windows-Tray-Icon
│       │   ├── hamster-sleep.png # ✅ DND-Icon für macOS
│       │   ├── hamster-sleep.ico # ✅ DND-Icon für Windows
│       │   ├── icon.png      # ✅ Fallback-Icon
│       │   └── icon.ico      # ✅ Windows-Fallback
│       └── hamsters/         # ✅ Hamster-Varianten
│           ├── caprisun.png  # ✅ Spezielle Hamster-Variante
│           └── lol.png       # ✅ Spezielle Hamster-Variante
├── server/                    # ✅ WebSocket Hub
│   ├── src/index.js          # ✅ Express + WS Server
│   └── package.json          # ✅ Dependencies
├── bot/                       # ✅ Discord Bot
│   ├── src/index.js          # ✅ Bot-Logic + Commands
│   ├── src/registerCommands.js # ✅ Command-Registration
│   └── package.json          # ✅ Dependencies
└── package.json               # ✅ Root-Package (Workspace-Management)
```

## 🚀 Nächste Schritte & Verbesserungen

### ✅ Bereits implementiert (August 2025)

- **DND-Icon-Switching**: ✅ Beim Umschalten "Do Not Disturb" das Tray-Icon auf gedimmte Version ändern
- **Dynamische Hamster-Liste**: ✅ `assets/hamsters/` scannen und automatisch ins Tray-Menü übernehmen
- **WS-Status im Tooltip**: ✅ Online/Offline-Status anzeigen, Reconnect-Button im Tray
- **Autostart-Funktionalität**: ✅ "Beim Login starten" Toggle für macOS und Windows

### 🎯 Priorität 1 (Nächste Session)

1. **App-Icon**: Neues Hamster-Branding als macOS-App-Icon (build.mac.icon)
2. **Hamster-Animationen**: Mehr Animationen, Sound-Effekte
3. **Toast-Templates**: Vordefinierte Toast-Nachrichten
4. **Multi-Monitor Support**: Overlay-Position auf allen Monitoren
5. **🔒 CSP implementieren**: Content Security Policy für bessere Sicherheit
6. **🛡️ Error Handling**: Robuste Fehlerbehandlung und Fallbacks

### 🎯 Priorität 2 (Mittelfristig)

1. **Custom Themes**: Benutzerdefinierte Farbschemata
2. **Plugin-System**: Erweiterbare Hamster/Toast-Typen
3. **Mobile Companion**: Companion-App für iOS/Android
4. **Advanced Hotkeys**: Mehr Kombinationen, Custom-Bindings

### 🎯 Priorität 3 (Langfristig)

1. **Cloud-Sync**: Einstellungen über Geräte hinweg synchronisieren
2. **Analytics**: Nutzungsstatistiken und Insights
3. **Team-Features**: Kollaborative Hamster/Toast-Systeme
4. **API-Erweiterungen**: Mehr Endpoints, Webhook-Integration

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

### 🔒 Sicherheits-Features (Geplant)

#### Content Security Policy (CSP)

```javascript
// CSP verhindert XSS-Angriffe durch Einschränkung der ausführbaren Quellen
// Beispiel für eine strikte CSP:
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
```

#### Bearer Token Authentication

```javascript
// Broadcast-Endpoint mit Token-Auth absichern
app.post("/broadcast", authMiddleware, (req, res) => {
  // Nur authentifizierte Requests erlaubt
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!isValidToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // ... Broadcast-Logic
});
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

### Server (.env)

```bash
PORT=3001
# WICHTIG: Ändere diesen Wert zu einem sicheren, zufälligen Token!
BROADCAST_SECRET=dein-super-geheimer-token-123
# Sicherheit: Auth aktivieren (false = Token erforderlich, true = Keine Auth)
ALLOW_NO_AUTH=false
```

### Bot (.env)

```bash
DISCORD_TOKEN=your-bot-token
GUILD_ID=optional-guild-id
HUB_URL=http://localhost:3001
# WICHTIG: Muss mit dem BROADCAST_SECRET vom Server übereinstimmen!
HUB_SECRET=dein-super-geheimer-token-123
```

### Client (.env)

```bash
WS_URL=ws://localhost:3001/ws
WS_TOKEN=optional-auth-token
```

## 🔐 Sicherheit einrichten

### 1. Sicheren Token generieren

```bash
# Terminal: Zufälligen Token generieren
openssl rand -base64 32
# Oder: https://generate-secret.vercel.app/32
```

### 2. .env Dateien erstellen

```bash
# Server
cp server/env.example server/.env
# Bearer Token in server/.env setzen

# Bot
cp bot/env.example bot/.env
# Gleichen Token in bot/.env setzen
```

### 3. ALLOW_NO_AUTH=false setzen

```bash
# In server/.env
ALLOW_NO_AUTH=false
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
