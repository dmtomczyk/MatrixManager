#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/lifecycle-common.sh"

usage() {
  cat <<'EOF'
Usage: ./manager.sh <command>

Commands:
  start    Build and start Matrix Manager containers
  stop     Stop Matrix Manager containers and preserve data
  status   Show compose status and probe /health
  reset    Delete Matrix Manager runtime data after confirmation
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' is not installed or not in PATH." >&2
    exit 1
  fi
}

command_name="${1:-}"
if [[ -z "$command_name" ]]; then
  usage
  exit 1
fi

case "$command_name" in
  start|stop|status|reset) ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Error: unknown command '$command_name'." >&2
    usage
    exit 1
    ;;
esac

require_docker_compose
load_env_if_present
cd "$MM_ROOT_DIR"

case "$command_name" in
  start)
    ensure_runtime_dirs
    if [[ ! -f "$MM_ENV_FILE" ]]; then
      echo "Warning: .env not found at $MM_ENV_FILE. Docker Compose will use defaults." >&2
    fi
    compose_cmd up -d --build
    echo "Matrix Manager started ($(get_install_mode) mode)."
    echo "Run ./manager.sh status to inspect health."
    ;;
  stop)
    compose_cmd down
    echo "Matrix Manager stopped. Data was preserved."
    ;;
  status)
    compose_cmd ps
    echo
    if command -v curl >/dev/null 2>&1; then
      APP_PORT="${MATRIX_APP_PORT:-8000}"
      if curl --fail --silent "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
        echo "Health endpoint: OK (http://127.0.0.1:${APP_PORT}/health)"
      else
        echo "Health endpoint: not reachable yet (http://127.0.0.1:${APP_PORT}/health)"
      fi
    else
      echo "curl not found; skipping HTTP health check."
    fi
    ;;
  reset)
    cat <<'EOF'
This will reset Matrix Manager application data.
It will remove:
- SQLite data
- control DB / user accounts / audit history / DB connection configs
- bundled PostgreSQL volume data

It will preserve:
- .env
- Docker/compose files
- installer/runtime scripts
EOF
    confirm_or_exit "Reset Matrix Manager data?"
    compose_cmd down -v --remove-orphans || true
    wipe_bind_mount_data
    ensure_runtime_dirs
    echo "Matrix Manager data reset complete."
    echo "You can now run ./manager.sh start or ./install.sh again."
    ;;
esac
