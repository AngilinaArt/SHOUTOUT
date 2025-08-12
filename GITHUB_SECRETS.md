# 🔐 GitHub Actions Secrets Setup

## Übersicht

Dieses Dokument erklärt, wie du GitHub Actions Secrets für sichere Builds verwendest, ohne sensible Daten im Repository zu speichern.

---

## 🎯 **Wie es funktioniert:**

### Lokale Entwicklung:

- Du erstellst eine lokale `.env` Datei mit deinen Entwicklungswerten
- Diese Datei wird NICHT ins Git committed (steht in `.gitignore`)

### Production Builds (GitHub Actions):

- GitHub Actions erstellt dynamisch eine `.env` Datei aus Secrets
- Die Secrets sind sicher in GitHub verschlüsselt gespeichert
- Nur während des Build-Prozesses verfügbar

---

## 🔧 **Setup Schritte:**

### 1. Lokale .env erstellen

```bash
# In client/ Verzeichnis:
cp env.example .env
```

Dann `.env` bearbeiten:

```env
WS_URL=ws://localhost:3001/ws
WS_TOKEN=
SERVER_URL=http://localhost:3001
NODE_ENV=development
```

### 2. GitHub Secrets konfigurieren

Gehe zu deinem GitHub Repository → Settings → Secrets and variables → Actions

**Erstelle diese Secrets:**

| Secret Name       | Beispiel Wert              | Beschreibung             |
| ----------------- | -------------------------- | ------------------------ |
| `PROD_WS_URL`     | `wss://dein-server.com/ws` | Production WebSocket URL |
| `PROD_WS_TOKEN`   | `your-secret-token`        | WebSocket Auth Token     |
| `PROD_SERVER_URL` | `https://dein-server.com`  | Production Server URL    |

### 3. Secrets hinzufügen

1. **Repository öffnen** → Settings
2. **Secrets and variables** → Actions
3. **"New repository secret"** klicken
4. **Name:** `PROD_WS_URL`
5. **Secret:** `wss://dein-netcup-server.com/ws`
6. **Add secret**

Wiederhole für alle Secrets!

---

## 🚀 **Build Prozess:**

### Automatisch bei Git Tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Manuell über GitHub Actions:

- Repository → Actions → "Build Desktop Apps" → "Run workflow"

---

## 🔒 **Sicherheit:**

✅ **Lokale .env** - Nur auf deinem Rechner  
✅ **GitHub Secrets** - Verschlüsselt in GitHub  
✅ **Build .env** - Nur während Build erstellt, dann gelöscht  
✅ **Keine sensiblen Daten** im Repository

---

## 📁 **Datei-Struktur:**

```
client/
├── .env                 # Lokal (nicht committed)
├── env.example          # Template (committed)
├── main.js             # Lädt dotenv
└── package.json        # Hat dotenv dependency
```

---

## 🛠️ **Troubleshooting:**

### Build schlägt fehl:

1. Prüfe ob alle Secrets gesetzt sind
2. Prüfe Secret-Namen (case-sensitive!)
3. Prüfe ob dotenv installiert ist: `npm list dotenv`

### Lokale Entwicklung:

1. Erstelle `.env` aus `env.example`
2. Fülle lokale Werte ein
3. Starte: `npm start`

---

## 💡 **Tipps:**

- **Entwicklung:** Verwende localhost URLs
- **Production:** Verwende deine echten Server URLs
- **Secrets:** Niemals in Code oder Kommentare schreiben
- **Testing:** Teste Build lokal vor Tag-Push

---

**Mit diesem Setup sind deine sensiblen Daten sicher! 🔐✨**
