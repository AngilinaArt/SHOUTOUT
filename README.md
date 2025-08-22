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
cd ../client && npm install

# Alle Services starten
npm run dev
```

### 🌐 Übersetzung (optional, lokal)

1. Python-Abhängigkeiten installieren (HF‑Modus):

```bash
pip install transformers torch sentencepiece
```

2. Übersetzer aktivieren (HF erzwingen):

```bash
# server/.env
TRANSLATOR_ENABLED=true
TRANSLATOR_PROVIDER=ct2
TRANSLATOR_FORCE_HF=true
```

3. App starten und im Tray „🌐 Translate…“ öffnen.

---

## 🏗️ Architektur

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Desktop App   │◄──────────────►│  WebSocket Hub  │
│   (Electron)    │                 │   (Node.js)     │
│                 │                 │   + Winston     │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │                                   │
         │ IPC                               │ HTTP API
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│   Tray Menu     │                 │  Hamster Assets │
│   + Overlays    │                 │  + User API     │
└─────────────────┘                 └─────────────────┘
```

### 🎯 Komponenten

- **`client/`** - Electron Desktop App mit Overlays
- **`server/`** - WebSocket Hub für Real-Time Kommunikation mit Winston Logging

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

#### 3. Desktop App starten

```bash
cd client

# Dependencies installieren
npm install

# App starten
npm start
```

#### 4. Alle Services gleichzeitig starten

```bash
# Im Root-Verzeichnis
npm run dev
```

### 🔐 Environment Variables

#### Server (.env)

```bash
PORT=3001

# Auth / Tokens
# Invite-Modus ist aktiv, sobald INVITE_CODES gesetzt ist ODER bereits Tokens ausgestellt wurden.
# In Invite-Modus erwarten alle geschützten Endpoints und der WS-Handshake einen ausgegebenen Client-Token.
INVITE_CODES=supersecret1,supersecret2
ADMIN_SECRET=super-admin-123
ALLOW_NO_AUTH=false

# Legacy/Fallback (wenn Invite nicht aktiv ist):
BROADCAST_SECRET=your-super-secret-token-123
# Optional separates Legacy-WS-Token (Query ?token=)
WS_TOKEN=

# Optional: Local translation (offline)
TRANSLATOR_ENABLED=true
TRANSLATOR_PROVIDER=ct2
# Optional override of script path
# TRANSLATOR_PY=./src/translate/ct2_translator.py
# CTranslate2 model paths
# CT2_MODEL_DE_EN=/absolute/path/to/ct2_models/de-en
# CT2_MODEL_EN_DE=/absolute/path/to/ct2_models/en-de
```

Notes
- Invite aktiv: Broadcast-/Admin-APIs akzeptieren nur gültige Tokens (bzw. `ADMIN_SECRET` für Admin‑APIs). WS nutzt bevorzugt `Authorization: Bearer <token>` im Handshake.
- Invite inaktiv (keine Codes, keine Tokens): Fallback auf `BROADCAST_SECRET` bzw. optional `WS_TOKEN`. Für Produktion `ALLOW_NO_AUTH=false` lassen.

#### Bot (.env)

```bash
DISCORD_TOKEN=your-discord-bot-token
GUILD_ID=optional-guild-id
HUB_URL=http://localhost:3001

# Wenn Invite aktiv ist, muss der Bot einen ausgegebenen Token verwenden (Authorization: Bearer <token>).
# Das frühere HUB_SECRET/BROADCAST_SECRET greift dann nicht mehr auf /broadcast.
# HUB_SECRET kann weiterhin für Legacy/Dev ohne Invite verwendet werden.
HUB_SECRET=
```

#### Client (.env)

```bash
WS_URL=ws://localhost:3001/ws
SERVER_URL=http://localhost:3001
# Kein WS_TOKEN mehr erforderlich – der Client holt per Invite-Code einen Token
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

- Statuszeile: „🟢 Your name: … (Online/…)“ — nicht klickbar
- ✏️ Change Name — aktiv wenn verbunden
- 🔄 Reconnect — immer verfügbar (außer beim Verbinden)
- 🔐 Logout (Token zurücksetzen) — aktiv wenn verbunden
- 🔕 Do Not Disturb — aktiv wenn verbunden
- 🚀 Autostart — aktiv wenn verbunden
- —
- 🐹 Send hamster — aktiv wenn verbunden
- 💬 Send Toast… — aktiv wenn verbunden
- 🌐 Translate… — aktiv wenn verbunden
- 👥 Show Online Users — aktiv wenn verbunden
- ℹ️ About Shoutout — aktiv wenn verbunden
- —
- ❌ Quit — immer verfügbar

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
- **Logging**: Winston, Daily Rotation
- **Build**: electron-builder, npm scripts
- **Styling**: CSS Grid, Flexbox, Glass Effects, Animations
- **Translation (optional, offline)**: CTranslate2 + SentencePiece + OPUS-MT (DE↔EN)

### 📁 Projektstruktur (aktuell)

```
shoutout/
├── client/                         # Electron Desktop App
│   ├── main.js                   # Hauptprozess (Tray, Overlays, WS)
│   ├── preload.js                # IPC Bridge (Overlay)
│   ├── preload_compose.js        # IPC Bridge (Toast-Compose)
│   ├── preload_name.js           # IPC Bridge (Name-Änderung)
│   ├── preload_status.js         # IPC Bridge (Status-Overlay)
│   ├── preload_reaction.js       # IPC Bridge (Reaction-Overlay)
│   ├── preload_userlist.js       # IPC Bridge (User-List)
│   ├── preload_invite.js         # IPC Bridge (Invite)
│   ├── preload_translate.js      # IPC Bridge (Translate)
│   ├── preload_about.js          # IPC Bridge (About)
│   ├── renderer/
│   │   ├── overlay.html          # Haupt-Overlay
│   │   ├── overlay.js            # Overlay-Logic (klassisch)
│   │   ├── overlay-new.js        # Overlay-Logic (neu)
│   │   ├── compose.html          # Toast-Erstellung (Glass)
│   │   ├── name.html             # Name-Änderung (Glass)
│   │   ├── invite.html           # Invite-Dialog (Glass)
│   │   ├── translate.html        # Translate (optional)
│   │   ├── status.html/js        # Status-Overlay
│   │   ├── reaction.html/js      # Reaction-Overlay
│   │   ├── userlist.html/js      # Online User List
│   │   ├── about.html            # About-Fenster
│   │   └── style.css             # Gemeinsame Styles
│   └── assets/
│       ├── icon/                 # App Icons
│       └── hamsters/             # Hamster-Varianten
├── server/                        # WebSocket Hub + HTTP API
│   ├── src/index.js              # Express + WS Server
│   ├── config/
│   │   ├── tokens.json           # Ausgestellte Tokens (gitignored)
│   │   └── invites.json          # Optionale Invite-Codes (Array)
│   ├── assets/hamsters/          # Serverseitige Hamster-Bilder
│   └── logs/                     # Winston Logfiles
├── bot/                           # Discord Bot (optional)
│   └── src/index.js              # Bot Logic + Commands
├── .github/workflows/build.yml    # Build-Pipeline (ohne WS_TOKEN)
└── package.json                   # Workspace Management
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

// Translate (Server, optional)
// HTTP JSON: POST /translate
// Body:
// {
//   text: "Freitext oder E-Mail-Inhalt",
//   direction: "auto" | "de-en" | "en-de",
//   formatMode: "auto" | "email" | "plain"
// }
// Response: { ok, from, to, format, translated }
```

#### HTTP Endpoints

```bash
# Invite: Austausch Invite-Code gegen Client-Token
POST /invite
Content-Type: application/json
{ "inviteCode": "supersecret1" }

# Token-Check (keine Nebenwirkungen)
GET /auth-check
Authorization: Bearer <token>

# Broadcast (geschützt)
POST /broadcast
Authorization: Bearer <token>
Content-Type: application/json

# Self-Revoke (Client kann eigenen Token widerrufen)
DELETE /revoke-self
Authorization: Bearer <token>

# Admin API (mit ADMIN_SECRET)
GET /tokens
Authorization: Bearer <ADMIN_SECRET>

DELETE /revoke/:tokenOrPrefix
Authorization: Bearer <ADMIN_SECRET>

# Admin UI (HTML)
GET /admin
# UI mit Login-Feld; Admin-Secret wird in der Sitzung (sessionStorage) gespeichert

# Online Users List
GET /users
```

#### Admin Utilities

- Token-Eigentümer ändern (Admin):

```bash
PATCH /reassign-owner/:tokenOrPrefix
Authorization: Bearer <ADMIN_SECRET>
Content-Type: application/json
{ "ownerId": "<new-user-id>" }
```

Hinweis: Der Server trennt bestehende Verbindungen des Tokens sofort (4001 „Token owner changed“); Clients müssen sich neu authentifizieren.

### 🧭 Onboarding & Tokens

- Erste App-Ausführung: Der Client zeigt eine kleine Eingabemaske „Invite‑Code eingeben“. Nach Erfolg wird der Token lokal gespeichert und der WS‑Handshake nutzt `Authorization: Bearer <token>`.
- Revoke: Widerruft ein Admin einen Token, trennt der Server die WS‑Verbindung (Code 4001). Der Client löscht den lokalen Token, zeigt die Invite‑Maske und verbindet nach Eingabe erneut – ohne App‑Neustart.
- Logout: Tray → „🔐 Logout (Token zurücksetzen)“ widerruft best‑effort (`DELETE /revoke-self`), löscht die lokale Datei und startet die App neu, um die Invite‑Maske zu zeigen.
- Reconnect: Bei manuellem „🔄 Reconnect“ prüft der Client den Token via `/auth-check` und fordert bei 401 den Invite‑Code erneut an.

### 🔐 Ownership Binding

- Jeder ausgegebene Token wird an eine stabile `ownerId` (UserID) gebunden; optional wird eine `deviceId` gespeichert.
- Der Client erzeugt/persistiert `userId` und `deviceId` in `client` → `shoutout-user.json` und sendet diese bei:
  - Invite: `POST /invite { inviteCode, ownerId, deviceId }`
  - WS-Handshake: Header `x-client-user: <userId>`, `x-client-device: <deviceId>`
  - Auth-Check: `GET /auth-check` mit `x-client-user`
- Server prüft im Invite‑Modus, dass `x-client-user` mit der beim Token gespeicherten `ownerId` übereinstimmt:
  - WS: 401 bei Mismatch (Client re‑authentifiziert)
  - `/auth-check`: 401 bei Mismatch
  - `/broadcast`: 401 bei Mismatch (kein HTTP‑Bypass)
- Admin UI zeigt zusätzlich den aktuellen Anzeigenamen (falls verbunden), sowie Device‑Prefix und `lastUsedAt`.

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

#### macOS: Ghosting/Phantom bei Toasts

Betroffene Systeme: Vor allem Apple Silicon (M1/M2) MacBooks mit transparenten Electron-Fenstern und `backdrop-filter`/starken Schatten.

Symptom: Nach dem Schließen eines Toasts bleibt eine „Geisterspur“/ein Phantom am Bildschirm stehen, bis ein Repaint erzwungen wird (Fenster bewegen, Mission Control, etc.).

Status: Behoben durch Workaround in `client/renderer/style.css` und `client/renderer/overlay-new.js` (Compositing-Hinweise + kurzes Fade‑Out). Keine Funktionsänderung, nur stabilere Repaints.

Manuelle Checks/Workarounds, falls es bei dir dennoch auftritt:

- Diagnose: `cd client && npm start -- --disable-gpu` — wenn das Phantom verschwindet, ist es GPU/Compositing-bedingt.
- DevTools‑Test: In Elements `.bubble` auswählen und `backdrop-filter` temporär deaktivieren; Toast schließen.
- Anzeigeeinstellungen: Systemeinstellungen → Bedienungshilfen → Anzeige → „Transparenz reduzieren“ testweise umschalten.
- Skalierung: Systemeinstellungen → Displays → Auf „Standard“ statt „Mehr Platz“ testen.
- Externes Display trennen und nur das interne Panel testen.

Hinweis: Der eingebaute Fix erzwingt ein sauberes Repaint über `translateZ(0)`, `backface-visibility: hidden`, `will-change`, `contain: paint` sowie ein kurzes Ausblend‑Transition, bevor ein Toast entfernt wird.

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
