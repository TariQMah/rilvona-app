#!/usr/bin/env bash
# Starts the Rilvona AI service (used by pm2). Reads .env next to this file; listens on localhost only.
set -euo pipefail
cd "$(dirname "$0")"
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a
exec .venv/bin/uvicorn app.main:app --host "${AI_HOST:-127.0.0.1}" --port "${AI_PORT:-4310}" --workers 1 --no-access-log
