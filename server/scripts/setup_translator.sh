#!/usr/bin/env bash
set -euo pipefail

# HF-only setup script for local translator (DE↔EN) using HuggingFace Marian
# - Creates Python venv in server/.venv (Python 3.12 recommended)
# - Installs: transformers, torch, sentencepiece
# - Clones HF models into server/models/hf/{opus-mt-de-en, opus-mt-en-de}
# - Updates server/.env (forces HF decoder)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Creating Python venv in .venv ..."
[ -d .venv ] || python3 -m venv .venv || true
source .venv/bin/activate
python3 -m pip install --upgrade pip
PY_MAJ_MIN="$(python3 - << 'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
if [[ "$PY_MAJ_MIN" =~ ^3\.1[3-9]$ ]]; then
  echo "[!] Detected Python $PY_MAJ_MIN in venv. PyTorch wheels may be unavailable."
  echo "    Consider using Python 3.10–3.12 for converter support."
fi

echo "[2/4] Installing Python packages: transformers, torch, sentencepiece ..."
python3 -m pip install -q --upgrade "transformers>=4.40,<5" torch sentencepiece || true

echo "[3/4] Fetching HF models locally ..."
mkdir -p models/hf
if command -v git >/dev/null 2>&1; then
  git lfs install || true
  [ -d models/hf/opus-mt-de-en ] || git clone https://huggingface.co/Helsinki-NLP/opus-mt-de-en models/hf/opus-mt-de-en || true
  [ -d models/hf/opus-mt-en-de ] || git clone https://huggingface.co/Helsinki-NLP/opus-mt-en-de models/hf/opus-mt-en-de || true
fi

# Ensure SentencePiece models are present alongside CT2 models
copy_spm_if_missing() {
  local hf_dir="$1"; shift
  local ct2_dir="$1"; shift
  if [ -d "$hf_dir" ] && [ -d "$ct2_dir" ]; then
    if [ ! -f "$ct2_dir/source.spm" ] && [ -f "$hf_dir/source.spm" ]; then
      cp "$hf_dir/source.spm" "$ct2_dir/" || true
    fi
    if [ ! -f "$ct2_dir/target.spm" ] && [ -f "$hf_dir/target.spm" ]; then
      cp "$hf_dir/target.spm" "$ct2_dir/" || true
    fi
  fi
}

copy_spm_if_missing models/hf/opus-mt-de-en models/ct2/de-en
copy_spm_if_missing models/hf/opus-mt-en-de models/ct2/en-de

echo "[4/4] Updating .env with settings ..."
[ -f .env ] || cp env.example .env || true

upsert() { key="$1"; val="$2"; if grep -q "^${key}=" .env 2>/dev/null; then sed -i.bak "s|^${key}=.*|${key}=${val}|" .env; else echo "${key}=${val}" >> .env; fi }
upsert TRANSLATOR_ENABLED true
upsert TRANSLATOR_PROVIDER ct2
upsert TRANSLATOR_FORCE_HF true

echo "Smoke test (python translator stub, HF mode) ..."
echo "Hallo Welt" | python3 src/translate/ct2_translator.py --from de --to en || true
echo "Done. Start server:  cd '$ROOT_DIR' && npm start"
echo "In the app: Tray → 🌐 Translate…"
