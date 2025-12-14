# Shoutout Bot – Setup Checklist

Kurz und praxisnah für DEV/PROD. Voraussetzung: Node ≥ 18, Discord-App erstellt, Bot zum Server eingeladen (Scope: `applications.commands`).

1) Discord-Bot vorbereiten
- DISCORD_TOKEN besorgen: Discord Developer Portal → Bot → Reset Token.
- Bot in die gewünschte Guild einladen (mit `applications.commands`).
- Optional: `GUILD_ID` notieren (schnellere Command-Registrierung).

2) Server-Erreichbarkeit prüfen
- `HUB_URL` setzen (DEV: `http://localhost:3001`, PROD: deine Domain/Port).
- Healthcheck: `curl -sS $HUB_URL/health` → `{ "ok": true }`.

3) Invite-Token für den Bot ausstellen (INVITE_ENABLED=true)
- Invite-Code wählen/verwenden (z. B. `supersecret1`).
- Token holen: `curl -sS -X POST $HUB_URL/invite -H 'content-type: application/json' -d '{"inviteCode":"<CODE>","ownerId":"discord-bot"}'`.
- Ergebnis `token` kopieren (z. B. `abc-123-...`).

4) bot/.env ausfüllen
- `DISCORD_TOKEN=<dein-discord-bot-token>`
- `GUILD_ID=<optional-deine-guild-id>`
- `HUB_URL=<z. B. http://localhost:3001>`
- `HUB_SECRET=<invite-token-aus-schritt-3>`
- `HUB_OWNER_ID=discord-bot` (muss zur `ownerId` aus Schritt 3 passen)

Hinweis: Wenn das Invite-System deaktiviert ist, nutzt `HUB_SECRET` das `BROADCAST_SECRET` des Servers und `HUB_OWNER_ID` entfällt.

5) Starten und prüfen
- `cd bot && npm install && npm start`
- Erwartete Logs:
  - `Hub health: { ok: true }`
  - `Auth-check: 200 {"ok":true}`
  - `Registered guild commands` (oder `Registered global commands`)
  - `Bot logged in as …`

6) Funktionstest
- In Discord `/toast` ausführen. Erfolgsmeldung sollte zurückkommen.

Troubleshooting
- 401 Unauthorized: Invite-Token falsch/abgelaufen oder `HUB_OWNER_ID` passt nicht zur `ownerId` des Tokens.
- Hub nicht erreichbar: `HUB_URL` prüfen, Port/Firewall/Docker-Portmapping kontrollieren.
- Commands fehlen: Bot in die Guild eingeladen? `GUILD_ID` korrekt? Global Commands können bis ~1h brauchen.

Prod-Empfehlungen
- Eigenes Invite-Token pro Umgebung. DEV-Token auf PROD nicht wiederverwenden.
- Alte Tokens bei Bedarf widerrufen (`/admin` oder `DELETE /revoke-self`).
- Secrets nicht committen; `.env` lokal oder über Secret-Store verwalten.

