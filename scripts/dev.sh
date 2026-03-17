#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

./scripts/dev-stop.sh >/dev/null 2>&1 || true

until ! fuser 8000/tcp >/dev/null 2>&1 && ! fuser 4173/tcp >/dev/null 2>&1; do
  sleep 0.25
done

./node_modules/.bin/concurrently \
  -k \
  -n api,ui \
  -c blue,magenta \
  "MATRIX_UI_DEV_URL=http://127.0.0.1:4173 ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" \
  "until curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; do sleep 0.25; done; ./node_modules/.bin/vite --config frontend/ui/vite.config.mjs"
