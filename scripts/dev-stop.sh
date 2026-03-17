#!/usr/bin/env bash
set -euo pipefail

pkill -f "vite --config frontend/ui/vite.config.mjs" || true
pkill -f "uvicorn app.main:app" || true
fuser -k 4173/tcp 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true
