# Changelog

All notable changes to this project will be documented in this file.

## IDEAS

- mini game implementieren
- kleine Soundeffekte die nicht nervig sind
- das Tray mit den Usern eventuell ausklappbar gestalten, damit das Fenster kleiner wird?

- notification after invite tokin that software runs in tray
- token valid until ...
- Rechtschreibprüfung für Translator bzw. "Aufweichung" damit auch fehlerhafte Texte einen Übersetzungsvorschlag erhalten
- Design nochmal checken, auf "einheitlichkeit"

- Untersütztung für Discord Bot, derzeit noch nicht implementiert

## UNRELEASED

- change(client/hamster-sound): Hamster‑Hinweiston auf `short-bang.mp3` umgestellt
  (vorab geladen; ersetzt `windows-xp-error-sound.mp3`).

- feature(client/click-sound): Einheitlicher Klick‑Sound `short.mp3` für Overlays
  (Toasts, Userlist) mit Override via `data-sound-url`. Preload (WebAudio/HTMLAudio),
  niedrige Latenz über `pointerdown` + Auto‑Resume des AudioContext.

- feature(client/send-sound): Neue Rubrik „🔊 Send sound to all“ im Tray. Broadcast
  von Sounds als WS‑Event `type: "sound"` inkl. Lautstärke. Überlagerung zeigt ein
  wackelndes Speaker‑Icon mit „✖ Stop“. Respektiert DND (keine lokale/remote Wiedergabe
  bei aktivem DND). Sendername wird angezeigt („von NAME“).

- feature(server/api-sounds): Dynamische Soundliste ab `server/assets/api-sounds`
  via `GET /api/sounds`. Neue Static‑Routes: `GET /assets/api-sounds/:file` (unterstützt
  Leerzeichen/URL‑Encoding) und `GET /assets/others/:file` (z. B. `speaker.png`).
  Client lädt die Liste, zeigt Dateinamen im Tray und nutzt die vom Server gelieferten URLs.

- improvement(client/sound-playback): Broadcast‑Sounds laufen robust über HTMLAudio
  (statt WebAudio‑Buffer). Autoplay erlaubt (`autoplay-policy=no-user-gesture-required`),
  Overlay‑Audio explizit unmuted. Deduplizierung doppelter Sound‑Events (lokal + WS)
  innerhalb 600 ms. Beep‑Fallback entfernt. Dauer‑Timer entfernt (Icon bleibt bis `ended`/Stop).

- feature(client/sound-stop): Expliziter Stop‑Button unter dem Speaker‑Icon (größer,
  besser klickbar). Overlay‑Click‑through wird beim Start des Sounds deaktiviert und
  nach Stop/Ende wieder aktiviert.

- improvement(client/overlay-position): Renderer erhält `overlay-position` (IPC) und
  setzt `body.pos-center`, wodurch Hamster/Toasts oben zentriert erscheinen. Speaker‑Icon
  neu bei `top: 56px`, damit „von NAME“ nicht abgeschnitten wird.

- improvement(client/invite-ux): Invite‑Fenster vergrößert (640×560), mehrfache
  Versuche möglich (OK nach Fehlversuch), Enter=OK, Esc=Abbrechen (beendet App).
  Nach erfolgreichem Invite kurzer Hinweis, dass die App als Tray/Menüleisten‑Icon läuft.


- fix(client/autostart): Nach erfolgreicher WS-Verbindung werden die Hamster-Varianten
  erneut vom Server geladen und Tray/Hotkeys bei Änderungen aktualisiert. Dadurch
  wird die „🐹 Send pic to all“-Liste nach Autostart korrekt befüllt, auch wenn der
  erste `/api/hamsters`-Fetch beim Systemstart (Netz/Server noch nicht bereit) fehlgeschlagen ist.

- improvement(client/hamster-duration): Standard-Anzeigedauer für Hamster erhöht
  (5000 ms). Dauer ist nun per `HAMSTER_DURATION_MS` (oder `DEFAULT_HAMSTER_DURATION_MS`)
  in der Client-Umgebung konfigurierbar. Hotkeys/Tray verwenden diese Dauer standardmäßig.

<!-- Reverted: client/hamster-close (× button) due to macOS glitching -->

- feature(client/overlay-position): Umschaltbare Bildschirmposition für Overlays
  (Hamster/Toasts/Reactions). Neuer Tray-Menüpunkt „📐 Position“ mit Optionen
  „Top right“ (Standard) und „Center (top)“. Einstellung wird in `shoutout-user.json`
  als `overlayPosition` gespeichert und bei Display-Änderungen angewendet.

- improvement(client/autostart-prompt): Beim manuellen Start (nicht via Autostart)
  Hinweis-Dialog, falls Autostart nicht aktiviert ist. Optionen: „Aktivieren“,
  „Nicht jetzt“, „Nicht mehr fragen“. Aktivierung setzt System-Login-Item (macOS/Windows)
  und aktualisiert das Tray. (- Autostart vorschlag beim Laden)

- feature(notify-sound): Beim Empfang von Nachrichten (Toasts) wird ein ICQ‑Sound
  abgespielt (`/assets/sounds/icq-message.wav`). Renderer erlaubt nun Audio via CSP
  (`media-src`). Server liefert Sounds unter `/assets/sounds/:file` mit passenden
  Content‑Types.

- improvement(hamster-sound): Beim Senden/Empfangen eines Hamster‑Pics wird ein
  eigener Sound abgespielt (`windows-xp-error.wav`). Beide Sounds werden beim Start
  vorab geladen/decodiert (Web Audio) für minimale Latenz. Tray bietet Schalter und
  Lautstärke‑Regler (100/70/40/0%).
  - Sender‑Doppelsound behoben: lokaler Hamster‑Echo wurde deaktiviert, stattdessen
    wird die Server‑Echo‑Nachricht gerendert (einmaliger Sound pro Hamster).

## RELEASE all included to V1.0.3

- Documentation and Screenshots for readme
- smaller Logo for git logo representation README.md
- security check
- die Toasts sollten farblich besser unterschieden werden, eventuell die Hintergrundfarbe anpassen an gewählte Farbe, eventuell schon beim Schreiben
- color for privat/personal toasts, change them to see the difference to "generel dms"

## RELEASE all included to V1.0.2_1

- fix(client): eliminate macOS ghosting/phantom of toasts on Apple Silicon (transparent Electron window + backdrop-filter). Added compositing hints (`translateZ(0)`, `backface-visibility: hidden`, `will-change`, `contain: paint`) and a short fade-out before removal to force clean repaints. Docs updated in README Troubleshooting.

- fix(client/status): apply the same anti-ghosting compositing hints and fade-out to Status overlay.
- fix(client/reaction): apply the same anti-ghosting compositing hints and fade-out to Reaction overlay.
- fix(client/userlist): apply the same compositing hints and fade-out to Online Users overlay.
- fix(client/hamster): renderer now prefers data URLs from main process; added `onerror` fallback to generic icon to avoid file:// 404s.
- fix(client/main): fetch hamster images via Node `http/https` and convert to data URLs to avoid CSP/CORP issues across machines; removed direct cross-origin image fallback in renderer.
- fix(client/csp): relaxed `img-src` CSP earlier; superseded by data-URL approach (kept safe defaults).
- security(server/ws): enforce WS token on `/ws` (query `?token=`). Expected token is `WS_TOKEN` or falls back to `BROADCAST_SECRET` when unset. Keeps `ALLOW_NO_AUTH=false` by default.
- security(server/headers): set `Cross-Origin-Resource-Policy: cross-origin` for hamster images and configure Helmet with `crossOriginResourcePolicy` (defensive; no longer required when clients use data URLs).
- ops(docker-compose): require runtime secrets via env (`BROADCAST_SECRET`, optional `WS_TOKEN`, `ALLOW_NO_AUTH=false`). Supports project-level `.env` without committing secrets.

- feature(server/self-revoke): add `DELETE /revoke-self` allowing a client to revoke its own token using `Authorization: Bearer <token>` (no admin secret). Closes any WS using that token.
- improvement(client/logout): when logging out, the client now best-effort calls `/revoke-self` with its token before deleting local credentials and restarting. Admin list reflects removal immediately.
- feature(server/auth-check): add `GET /auth-check` for clients to validate their token without side effects (200 or 401).
- improvement(client/reconnect): `Reconnect` now opens the invite prompt if no token is stored or if `/auth-check` returns 401 for the current token; otherwise proceeds to reconnect.

## 2025-08-22 — Owner Binding, Admin UI, Ghosting Fixes

- feature(server/owner-binding): tokens now carry metadata `{ ownerId, deviceId, createdAt, lastUsedAt }`. WS handshake and `/auth-check` enforce that header `x-client-user` matches the token's `ownerId` (401 on mismatch). `/broadcast` authorization also checks the owner to prevent HTTP bypass.
- feature(client/ids): client persists stable `userId` and `deviceId` in `shoutout-user.json` and sends them on `/invite` and WS headers (`x-client-user`, `x-client-device`).
- feature(server/admin-ui/columns): admin token list shows Owner (prefix), Name (current display name if connected), Device (prefix), Last Used.
- feature(server/admin/reassign-owner): added `PATCH /reassign-owner/:token` (admin only) to change a token's ownerId; all WS using that token are closed with code `4001` ("Token owner changed"). Admin UI adds an “Owner…” action per row.
- fix(server/invite-disable): `/invite` returns 403 `invite_disabled` when no invite codes are configured (neither env `INVITE_CODES` nor `server/config/invites.json`).
- change(client/revoke-flow): when a token is revoked or owner changed (WS code 4001), client clears local token, shows re-auth prompt, and reconnects after success (no app restart).
- fix(client/logout-dialog): prevent double dialog on logout with a reentrancy guard; logout now best‑effort calls `/revoke-self` then restarts.
- improvement(client/tray-gating): when not connected, only “🔄 Reconnect” and “❌ Quit” remain clickable; all other actions (Change Name, Toast, Hamsters, Translate, Online Users, About, Logout, DND, Autostart) are disabled.
- improvement(client/reconnect/telemetry): added `/auth-check` usage with `x-client-user`; status overlay warns on temporary server unreachability.
- improvement(client/invite+name UI): refreshed to glass style, enlarged, and aligned with Compose window. Applied macOS ghosting workarounds (compositing hints, stable blur backplate, native vibrancy on macOS).
- improvement(server/admin-csp+login): CSP hardened via nonces; Admin UI no longer requires `?secret=` in URL — shows a login field and stores secret in sessionStorage for API calls. Favicon handled with 204.
- ops(ci): removed `WS_TOKEN` from client build workflow; client relies on invite/token onboarding.

## 2025-08-21 — Invite/Auth, Admin Dashboard, Force Logout

- feature(server/invite): added POST `/invite` to exchange a valid invite code for a client token. Invite codes are read from `INVITE_CODES` env or optional `server/config/invites.json`.
- feature(server/tokens): tokens are stored in `server/config/tokens.json` and now persist as objects `{ token, createdAt }`. Legacy arrays of strings auto-upgrade on next write.
- feature(server/auth): all protected routes validate with issued tokens when the invite system is active. `/broadcast` now expects `Authorization: Bearer <token>`. WebSocket `/ws` accepts `Authorization: Bearer <token>` (preferred) or legacy `?token=` query.
- feature(server/admin-api): added admin endpoints secured by `ADMIN_SECRET`:
  - GET `/tokens` → returns list of `{ prefix, createdAt }` (no full tokens)
  - DELETE `/revoke/:token` → revokes by exact token or unique prefix; response `{ revoked, closed }` where `closed` is the number of WS connections terminated.
- feature(server/admin-ui): added GET `/admin?secret=<ADMIN_SECRET>` — a tiny HTML dashboard (no frameworks) that lists tokens, and allows revoking via the admin API. Uses the `secret` query value as the Authorization header for calls.
- feature(server/revoke-ws): when a token is revoked, all active WebSocket connections that used that token are immediately closed with code `4001` and reason `"Token revoked"`.
- feature(client/invite): on first launch or if no token is stored, show a small “Invite-Code eingeben” window. On success, the token is stored at `app.getPath('userData')/shoutout-auth.json` (encrypted with `safeStorage` when available).
- feature(client/ws-auth): client connects WS with `Authorization: Bearer <token>`; falls back to legacy `WS_TOKEN` query when no invite is configured.
- feature(client/logout): new tray item “🔐 Logout (Token zurücksetzen)” löscht die lokale Token-Datei, widerruft best-effort per `/revoke-self`, zeigt eine Bestätigung und startet die App neu.
- change(client/revoke-flow): wenn der Server die Verbindung mit Code `4001` (Token widerrufen) schließt, öffnet der Client jetzt ein Re-Auth Prompt (Invite-Code) und verbindet neu — kein App-Restart mehr.
- ops(server/env): `server/env.example` now documents `INVITE_CODES` and adds `ADMIN_SECRET=super-admin-123`.
- ops(git): `server/config/.gitignore` ignores `tokens.json` so issued tokens are never committed.

Notes & Compatibility

- If no invite codes are configured and there are no issued tokens, the server falls back to the previous single-secret behavior (`BROADCAST_SECRET` / `WS_TOKEN`). Set `ALLOW_NO_AUTH=false` in production.
- Token store format changed from array-of-strings to array-of-objects with `createdAt`. Existing files are auto-upgraded when the server persists the token store.

How to Test Locally

- Server setup

  - In `server/.env` set:
    - `INVITE_CODES=supersecret1,supersecret2`
    - `ADMIN_SECRET=super-admin-123`
    - `ALLOW_NO_AUTH=false`
  - Start the server. Verify health at `GET /health`.

- Invite/token issuance

  - `curl -X POST http://localhost:3001/invite -H 'content-type: application/json' -d '{"inviteCode":"supersecret1"}'`
  - Response includes `{ "token": "..." }`; `server/config/tokens.json` will have `{ token, createdAt }` entries.

- Auth on /broadcast

  - `curl -X POST http://localhost:3001/broadcast -H "Authorization: Bearer <token>" -H 'content-type: application/json' -d '{"type":"toast","message":"Hi"}'`
  - Expect `{ ok: true, sent: N }` if clients are connected.

- WebSocket auth

  - Start the Electron client. On first run it asks for an invite code. Enter `supersecret1`.
  - After success, the client auto-connects WS with `Authorization: Bearer <token>` and can receive messages.

- Admin API

  - List tokens: `curl -H 'Authorization: Bearer super-admin-123' http://localhost:3001/tokens`
  - Revoke (by prefix or full token): `curl -X DELETE -H 'Authorization: Bearer super-admin-123' http://localhost:3001/revoke/<prefix-or-token>`
  - Response includes `{ revoked, closed }` and logs: `Revoked token <prefix> by admin` and `Closed X WS connection(s) ...`.

- Admin Dashboard (HTML)

  - Visit `http://localhost:3001/admin?secret=super-admin-123`.
  - The table lists tokens with prefix + createdAt. Click “Revoke” to delete. Upon success, the row is removed and an alert shows how many connections were closed.

- Client logout flows
  - Manual: tray → “🔐 Logout (Token zurücksetzen)” → dialog → app restarts → invite prompt appears.
  - Forced: revoke the token used by the client → WS closes with code `4001` → client auto-deletes token and restarts to re-run onboarding.
