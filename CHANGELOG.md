# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

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
