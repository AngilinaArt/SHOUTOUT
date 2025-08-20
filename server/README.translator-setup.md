# Shoutout Translator: Production Setup (HF/Marian)

This README documents a reliable, repeatable way to deploy the translator feature on a production Linux server (e.g., Netcup). It matches the working local configuration and uses HuggingFace/Marian for stable quality.

## Overview

- Default provider flag remains `ct2` (so Node spawns the Python script), but we force the high‑quality HuggingFace/Marian decoder via `TRANSLATOR_FORCE_HF=true`.
- The server automatically prefers the virtualenv Python at `server/.venv/bin/python3`, so Python packages are isolated from the system.
- Models are stored locally under `server/models/hf/...` (HF repos).

## Requirements

- Node.js LTS (18/20) and `npm`
- Python 3.12 (recommended)
- `git` and `git-lfs`
- ~1 GB free space (HF models ~600 MB + Python packages)

Notes about Python 3.12:
- If your distro doesn’t ship 3.12, install via one of:
  - Debian/Ubuntu: deadsnakes PPA or `pyenv` (common on VPS)
  - Generic: https://github.com/pyenv/pyenv

## Quick Start (HF)

The HF‑only path yields quality comparable to your local setup and is simplest to maintain.

1) Clone and install server deps

```bash
git clone <your-repo-url>
cd _PROJEKT_shoutout/server
npm install
```

2) Create Python 3.12 virtualenv and install packages

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install transformers torch sentencepiece
# (no CTranslate2 needed)
```

3) Fetch HF models locally (offline-friendly)

```bash
git lfs install
mkdir -p models/hf
git clone https://huggingface.co/Helsinki-NLP/opus-mt-de-en models/hf/opus-mt-de-en
git clone https://huggingface.co/Helsinki-NLP/opus-mt-en-de models/hf/opus-mt-en-de
# Optional: force pulling large files
git -C models/hf/opus-mt-de-en lfs pull
git -C models/hf/opus-mt-en-de lfs pull
```

4) Configure environment

```bash
cp env.example .env
```

Set the following in `server/.env`:

```ini
TRANSLATOR_ENABLED=true
TRANSLATOR_PROVIDER=ct2
TRANSLATOR_FORCE_HF=true

# Security
ALLOW_NO_AUTH=false
BROADCAST_SECRET=<set-a-strong-random-token>

# CT2 paths are not required when forcing HF, but can remain:
# CT2_MODEL_DE_EN=/absolute/path/to/server/models/ct2/de-en
# CT2_MODEL_EN_DE=/absolute/path/to/server/models/ct2/en-de
```

5) Start the server

```bash
NODE_ENV=production PORT=3001 npm start
```

6) Verify

- “Hallo Welt” → “Hello world”
- “Das muss ich mit meinen Kollegen besprechen” → “I have to discuss this with my colleagues.”
- The app tray action “🌐 Translate…” should work accordingly.

## Notes on configuration

Keep in `server/.env`:

```ini
TRANSLATOR_ENABLED=true
TRANSLATOR_PROVIDER=ct2
TRANSLATOR_FORCE_HF=true
```

## Service (systemd) example

Example unit file `/etc/systemd/system/shoutout-server.service`:

```ini
[Unit]
Description=Shoutout Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/shoutout/server
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm start
Restart=on-failure
User=shoutout
Group=shoutout

[Install]
WantedBy=multi-user.target
```

Notes:
- Ensure the repo resides at `/opt/shoutout` (or update `WorkingDirectory`).
- Run as a non-root user. That user must have run `git lfs install` at least once and own `server/.venv`.
- Load secrets via `.env` in `server/`. `npm start` reads it through the Node process (dotenv).

Commands:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shoutout-server
sudo systemctl status shoutout-server
```

## Security checklist

- Set a strong `BROADCAST_SECRET` in `server/.env`.
- Keep `ALLOW_NO_AUTH=false` in production.
- Expose `PORT` only as needed (use firewall/reverse proxy).
- Keep `server/.venv` owned by the service user, not world-writable.

## How it works (internals)

- Node uses `server/src/index.js` to spawn the Python translator and prefers `server/.venv/bin/python3`.
- The Python script `server/src/translate/ct2_translator.py` nutzt HF/Marian (erzwungen via `TRANSLATOR_FORCE_HF=true`) und ist so konfiguriert, dass Wiederholungen vermieden werden (Beam‑Search, no‑repeat‑ngrams, Repetitions‑Penalty, Early‑Stopping).
- HF models are loaded directly from `server/models/hf/...` (offline-friendly).

## Troubleshooting

- Python 3.12 missing:
  - Install via OS package manager or `pyenv`.
- Torch wheel unavailable:
  - Ensure Python 3.10–3.12; `pip install torch` should fetch a prebuilt wheel for Linux x86_64.
- `git lfs` errors or tiny model files:
  - Run `git lfs install` and `git lfs pull` in the HF model dirs.
- Translator returns repeated words:
  - Ensure `TRANSLATOR_FORCE_HF=true` and HF models exist under `server/models/hf/...`.
- Node uses wrong Python interpreter:
  - Confirm `server/.venv/bin/python3` exists; `index.js` prefers it automatically.
- Permissions:
  - Service user must own/execute inside `server/` and `.venv`.

## Upgrade routine

```bash
cd /opt/shoutout
git pull
cd server
npm ci
source .venv/bin/activate
python -m pip install -U pip transformers torch sentencepiece
systemctl restart shoutout-server
```

## Minimal verification script

```bash
cd /opt/shoutout/server
source .venv/bin/activate
echo "Hallo Welt" | python3 src/translate/ct2_translator.py --from de --to en
```

Expected: JSON with `translated` text (e.g., “Hello world”) and `provider: hf` if forced.
