# 🐹 Shoutout - Desktop Notification System

> **Ein zauberhaftes Desktop-Notification-System mit Hamster-Overlays, Toast-Nachrichten und Emoji-Reactions!** ✨

[![Status](https://img.shields.io/badge/Status-Produktionsreif-brightgreen.svg)](https://github.com/yourusername/shoutout)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue.svg)](https://github.com/yourusername/shoutout)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/yourusername/shoutout)

## 🎯 Was ist Shoutout?

**Shoutout** ist ein einzigartiges Desktop-Notification-System, das deine Arbeitsumgebung mit süßen Hamster-Animationen und intelligenten Toast-Nachrichten bereichert. Perfekt für Teams, Remote-Arbeit oder einfach nur, um deinen Tag mit etwas Niedlichkeit zu versüßen! 🎉

### ✨ Features

- 🐹 **Hamster-Overlays** - Süße Animationen mit verschiedenen Varianten
- 💬 **Toast-Nachrichten** - Intelligente Benachrichtigungen mit Reply-Funktion
- 💖 **Emoji-Reactions** - Schnelle Reaktionen mit visuellen Effekten
- 👥 **Online User List** - Sieh wer gerade online ist
- 🔔 **Status-Overlay** - System-Nachrichten und Bestätigungen
- ⌨️ **Global Hotkeys** - Schneller Zugriff von überall
- 🎯 **Targeted Messages** - Persönliche oder Broadcast-Nachrichten
- 🌙 **Do Not Disturb** - Störungsfreie Arbeitszeiten
- 🚀 **Autostart** - Startet automatisch beim Systemstart
- 🎨 **Cursor Theme + Glass Effects** - Moderne, elegante UI

---

## 🚀 Quick Start

### 📥 Download (Coming Soon!)

- **macOS**: `Shoutout.dmg` (Intel + Apple Silicon)
- **Windows**: `Shoutout-Setup.exe`
- **Linux**: `shoutout.AppImage`

### 🔧 Für Entwickler

```bash
# Repository klonen
git clone https://github.com/yourusername/shoutout.git
cd shoutout

# Dependencies installieren
npm install
cd server && npm install
cd ../bot && npm install
cd ../client && npm install

# Alle Services starten
npm run dev
```

---

## 🏗️ Architektur

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Desktop App   │◄──────────────►│  WebSocket Hub  │
│   (Electron)    │                 │   (Node.js)     │
└─────────────────┘                 └─────────────────┘
         │                                   ▲
         │                                   │
         │ IPC                               │ HTTP
         ▼                                   │
┌─────────────────┐                         │
│   Discord Bot   │─────────────────────────┘
│   (Node.js)     │
└─────────────────┘
```

### 🎯 Komponenten

- **`client/`** - Electron Desktop App mit Overlays
- **`server/`** - WebSocket Hub für Real-Time Kommunikation
- **`bot/`** - Discord Bot für Remote-Triggering

---

## 🔧 Developer Setup

### 📋 Voraussetzungen

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (kommt mit Node.js)
- **Git** ([Download](https://git-scm.com/))
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools

### 🚀 Lokale Entwicklung

#### 1. Repository Setup

```bash
# Repository klonen
git clone https://github.com/yourusername/shoutout.git
cd shoutout

# Dependencies installieren (alle Packages)
npm install
```

#### 2. Server starten

```bash
cd server

# Dependencies installieren
npm install

# .env Datei erstellen
cp .env.example .env

# Server starten
npm start
```

**Server läuft auf:** `http://localhost:3001`

#### 3. Discord Bot (Optional)

```bash
cd bot

# Dependencies installieren
npm install

# .env Datei erstellen
cp .env.example .env

# Bot starten
npm start
```

#### 4. Desktop App starten

```bash
cd client

# Dependencies installieren
npm install

# App starten
npm start
```

#### 5. Alle Services gleichzeitig starten

```bash
# Im Root-Verzeichnis
npm run dev
```

### 🔐 Environment Variables

#### Server (.env)

```bash
PORT=3001
BROADCAST_SECRET=your-super-secret-token-123
ALLOW_NO_AUTH=false
```

#### Bot (.env)

```bash
DISCORD_TOKEN=your-discord-bot-token
GUILD_ID=optional-guild-id
HUB_URL=http://localhost:3001
HUB_SECRET=your-super-secret-token-123
```

#### Client (.env)

```bash
WS_URL=ws://localhost:3001/ws
```

### 🏗️ Build & Distribution

#### macOS Build

```bash
cd client
npm run build:mac
# Erstellt: dist/Shoutout.dmg
```

#### Windows Build

```bash
cd client
npm run build:win
# Erstellt: dist/Shoutout Setup.exe
```

#### Linux Build

```bash
cd client
npm run build:linux
# Erstellt: dist/shoutout.AppImage
```

---

## 📱 Screenshots

### 🐹 Hamster Overlay

![Hamster Overlay](docs/screenshots/hamster-overlay.png)

### 💬 Toast Messages

![Toast Messages](docs/screenshots/toast-messages.png)

### 👥 Online User List

![User List](docs/screenshots/user-list.png)

### 🎨 Send Toast Window

![Send Toast](docs/screenshots/send-toast.png)

---

## 📥 Installation

### 🪟 Windows

1. **Download** den Windows Installer (`.exe`)
2. **Doppelklick** auf die Datei
3. **Installation bestätigen** und folgen
4. **App starten** über Start-Menü oder Desktop

### 🍎 macOS

1. **Download** den macOS Installer (`.dmg`)
2. **DMG öffnen** und App in den Applications-Ordner ziehen
3. **App starten** über Applications-Ordner

**⚠️ Wichtig:** Bei der ersten Ausführung zeigt macOS "Datei beschädigt" an. Das ist normal für nicht-code-signed Apps!

**Lösung:**

```bash
# 1. Quarantäne-Flag entfernen
xattr -dr com.apple.quarantine "/Applications/Hamster & Toast.app"

# 2. Ad-hoc signieren
codesign --force --deep --sign - "/Applications/Hamster & Toast.app"

# 3. App starten
open "/Applications/Hamster & Toast.app"
```

**Alternativ:** Rechtsklick auf die App → "Öffnen" wählen

---

## 🎮 Verwendung

### ⌨️ Global Hotkeys

- **`Cmd+Alt+H`** (macOS) / **`Ctrl+Alt+H`** (Windows) - Hamster anzeigen
- **`Cmd+Alt+T`** (macOS) / **`Ctrl+Alt+T`** (Windows) - Toast senden
- **`Cmd+Alt+1`** / **`Ctrl+Alt+1`** - Caprisun Hamster
- **`Cmd+Alt+2`** / **`Ctrl+Alt+2`** - LOL Hamster

### 🎯 Tray Menu

- **🟢 Your name** - Aktueller Status und Name
- **✏️ Change Name** - Namen ändern
- **🔄 Reconnect** - WebSocket neu verbinden
- **🔕 Do Not Disturb** - Störungen blockieren
- **🚀 Autostart** - Beim Login starten
- **🐹 Send hamster** - Hamster-Varianten
- **💬 Send Toast** - Nachricht senden
- **👥 Show Online Users** - Online-User anzeigen
- **❌ Quit** - App beenden

### 💬 Toast System

- **Persönlich** - Nur für einen User
- **Broadcast** - Für alle User
- **Reply** - Direkte Antwort auf Nachricht
- **Emoji Reactions** - 💖 👍 👎 🎉

---

## 🔧 Technische Details

### 🏗️ Tech Stack

- **Frontend**: Electron, HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express, WebSocket (ws)
- **Bot**: Discord.js, Slash Commands
- **Build**: electron-builder, npm scripts
- **Styling**: CSS Grid, Flexbox, Glass Effects, Animations

### 📁 Projektstruktur

```
shoutout/
├── client/                    # Electron Desktop App
│   ├── main.js              # Hauptprozess (Tray, Overlays, WS)
│   ├── preload.js           # IPC Bridge für Overlay
│   ├── preload_compose.js   # IPC Bridge für Toast-Compose
│   ├── preload_name.js      # IPC Bridge für Name-Änderung
│   ├── preload_status.js    # IPC Bridge für Status-Overlay
│   ├── preload_reaction.js  # IPC Bridge für Reaction-Overlay
│   ├── preload_userlist.js  # IPC Bridge für User-List
│   ├── renderer/            # UI-Komponenten
│   │   ├── overlay.html     # Haupt-Overlay
│   │   ├── overlay.js       # Overlay-Logic
│   │   ├── compose.html     # Toast-Erstellung
│   │   ├── name.html        # Name-Änderung
│   │   ├── status.html      # Status-Overlay
│   │   ├── reaction.html    # Reaction-Overlay
│   │   ├── userlist.html    # Online User List
│   │   ├── userlist.js      # User List Logic
│   │   ├── status.js        # Status Logic
│   │   ├── reaction.js      # Reaction Logic
│   │   └── style.css        # Styling
│   └── assets/              # Bilder und Icons
│       ├── icon/            # App Icons
│       └── hamsters/        # Hamster-Varianten
├── server/                   # WebSocket Hub
│   └── src/index.js         # Express + WS Server
├── bot/                      # Discord Bot
│   └── src/index.js         # Bot Logic + Commands
└── package.json              # Workspace Management
```

### 🔌 API Endpoints

#### WebSocket Events

```javascript
// Hamster Event
{
  type: "hamster",
  variant: "default" | "caprisun" | "lol",
  duration: 3000,
  target: "username", // optional
  sender: "username"
}

// Toast Event
{
  type: "toast",
  message: "Nachricht (max 280 Zeichen)",
  severity: "blue" | "green" | "pink" | "red" | "info" | "success" | "warn" | "critical",
  target: "username", // optional
  sender: "username"
}

// Reaction Event
{
  type: "reaction",
  reaction: "💖" | "👍" | "👎" | "🎉",
  targetUserId: "uuid",
  fromUser: "username"
}
```

#### HTTP Endpoints

```bash
# Broadcast Event (mit Auth)
POST /broadcast
Authorization: Bearer your-secret-token
Content-Type: application/json

# Online Users List
GET /users
```

---

## 🚨 Troubleshooting

### ❌ Häufige Probleme

#### App startet nicht

```bash
# Alle Electron-Prozesse beenden
pkill -f "electron"

# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```

#### WebSocket-Verbindung fehlschlägt

```bash
# Server-Status prüfen
curl http://localhost:3001/health

# Port prüfen
lsof -i :3001
```

#### Build-Fehler

```bash
# Dependencies prüfen
npm ls electron

# electron-builder neu installieren
npm install --save-dev electron-builder
```

### 🔍 Debug-Modus

```bash
# DevTools aktivieren
# In client/main.js: overlayWindow.openDevTools()

# Logs anzeigen
tail -f /tmp/server.log
```

---

## 🤝 Contributing

**Wir freuen uns über deine Beiträge!** 🎉

### 📋 Contributing Guidelines

1. **Fork** das Repository
2. **Feature Branch** erstellen (`git checkout -b feature/amazing-feature`)
3. **Changes** committen (`git commit -m 'Add amazing feature'`)
4. **Branch** pushen (`git push origin feature/amazing-feature`)
5. **Pull Request** erstellen

### 🎯 Entwicklungsworkflow

```bash
# Feature Branch erstellen
git checkout -b feature/new-feature

# Änderungen machen
# ... code ...

# Tests laufen lassen
npm test

# Committen
git add .
git commit -m "feat: add new feature"

# Pushen
git push origin feature/new-feature
```

### 🧪 Testing

```bash
# Alle Tests laufen lassen
npm test

# Spezifische Tests
npm run test:client
npm run test:server
npm run test:bot
```

---

## 📄 License

**MIT License** - Siehe [LICENSE](LICENSE) für Details.◊

---

## 🙏 Danksagungen

- **Electron Team** - Für das fantastische Framework
- **Node.js Community** - Für die großartigen Packages
- **CSS Glass Effects** - Für die wunderschöne UI
- **Hamster-Community** - Für die Inspiration 🐹

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/shoutout/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/shoutout/discussions)
- **Wiki**: [GitHub Wiki](https://github.com/yourusername/shoutout/wiki)

---

**Made with ❤️ and 🐹 by the Shoutout Team Angilina und Cursor AI Claude und GPT**

**Letzte Aktualisierung**: August 2025
**Version**: 1.0.0  
**Status**: 🟢 Produktionsreif
