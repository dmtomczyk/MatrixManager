#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE_FILE="${ROOT_DIR}/.env.example"
DATA_SQLITE_DIR="${ROOT_DIR}/data/sqlite"
DATA_APP_DIR="${ROOT_DIR}/data/app"
DATA_BACKUPS_DIR="${ROOT_DIR}/data/backups"
DEFAULT_PORT="8000"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_POSTGRES_DB="${POSTGRES_DB:-matrixmanager}"
DEFAULT_POSTGRES_USER="${POSTGRES_USER:-matrixmanager}"
DEFAULT_POSTGRES_SSLMODE="${POSTGRES_SSLMODE:-prefer}"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' is not installed or not in PATH." >&2
    exit 1
  fi
}

random_secret() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
}

prompt_with_default() {
  local prompt="$1"
  local default="$2"
  local value
  read -r -p "$prompt [$default]: " value
  if [[ -z "$value" ]]; then
    value="$default"
  fi
  printf '%s' "$value"
}

prompt_yes_no() {
  local prompt="$1"
  local default="$2"
  local suffix="[y/N]"
  if [[ "$default" == "yes" ]]; then
    suffix="[Y/n]"
  fi
  local value
  read -r -p "$prompt $suffix: " value
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$value" ]]; then
    value="$default"
  fi
  if [[ "$value" == "y" || "$value" == "yes" ]]; then
    return 0
  fi
  return 1
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-60}"
  local sleep_seconds="${3:-2}"
  local i
  for ((i=1; i<=attempts; i++)); do
    if curl --fail --silent "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done
  return 1
}

ensure_dir_or_fallback() {
  local preferred="$1"
  local fallback="$2"
  if mkdir -p "$preferred" 2>/dev/null; then
    printf '%s' "$preferred"
    return 0
  fi
  mkdir -p "$fallback"
  printf '%s' "$fallback"
}

get_compose_project_name() {
  if [[ -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
    printf '%s' "$COMPOSE_PROJECT_NAME"
  else
    basename "$ROOT_DIR"
  fi
}

existing_postgres_volume_name() {
  local project_name
  project_name="$(get_compose_project_name)"
  docker volume ls --format '{{.Name}}' | grep -E "^${project_name}_postgres_data$" | head -n 1 || true
}

get_matrixmanager_version() {
  if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$ROOT_DIR" describe --tags --always --dirty 2>/dev/null || git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'dev'
    return 0
  fi
  printf 'dev'
}

require_command docker
require_command curl
require_command python3

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose is required but not available." >&2
  exit 1
fi

mkdir -p "$DATA_SQLITE_DIR" "$DATA_APP_DIR"
DATA_BACKUPS_DIR="$(ensure_dir_or_fallback "$DATA_BACKUPS_DIR" "${ROOT_DIR}/backups")"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ ! -f "$ENV_EXAMPLE_FILE" ]]; then
  echo "Error: .env.example is missing at $ENV_EXAMPLE_FILE" >&2
  exit 1
fi

echo "Matrix Manager beta installer"
echo "Project root: $ROOT_DIR"
echo

INSTALL_MODE="$(prompt_with_default "Install mode (postgresql/sqlite)" "${MATRIX_INSTALL_MODE:-postgresql}")"
INSTALL_MODE="$(printf '%s' "$INSTALL_MODE" | tr '[:upper:]' '[:lower:]')"
if [[ "$INSTALL_MODE" != "sqlite" && "$INSTALL_MODE" != "postgresql" ]]; then
  echo "Error: install mode must be 'sqlite' or 'postgresql'." >&2
  exit 1
fi

APP_PORT="$(prompt_with_default "Host port for Matrix Manager" "$DEFAULT_PORT")"
ADMIN_USERNAME="$(prompt_with_default "Admin username" "$DEFAULT_ADMIN_USERNAME")"
read -r -s -p "Admin password (leave blank to auto-generate): " ADMIN_PASSWORD
echo
if [[ -z "$ADMIN_PASSWORD" ]]; then
  ADMIN_PASSWORD="$(random_secret)"
  GENERATED_ADMIN_PASSWORD="yes"
else
  GENERATED_ADMIN_PASSWORD="no"
fi

BASE_URL_DEFAULT="http://127.0.0.1:${APP_PORT}"
MATRIX_BASE_URL="$(prompt_with_default "Base URL" "$BASE_URL_DEFAULT")"
MATRIXMANAGER_VERSION="$(get_matrixmanager_version)"
if prompt_yes_no "Seed starter data (Default Org, Manager/Not Assigned job codes, Example Project, Jane/John Doe)?" "yes"; then
  SEED_STARTER_DATA="yes"
else
  SEED_STARTER_DATA="no"
fi
MATRIX_AUTH_SECRET="$(random_secret)"
MATRIX_SQLITE_PATH="/data/sqlite/matrix.db"
MATRIX_CONTROL_DB_PATH="/data/app/matrixmanager_control.db"
MATRIX_TS_DATA_DB_PATH="/data/sqlite/matrixmanager-ts-data.sqlite"
MATRIX_TS_CONTROL_DB_PATH="/data/app/matrixmanager-ts-control.sqlite"
POSTGRES_HOST="postgres"
POSTGRES_PORT="5432"
POSTGRES_DB="$DEFAULT_POSTGRES_DB"
POSTGRES_USER="$DEFAULT_POSTGRES_USER"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_SSLMODE="$DEFAULT_POSTGRES_SSLMODE"
POSTGRES_DATA_ACTION="fresh"

if [[ "$INSTALL_MODE" == "postgresql" ]]; then
  EXISTING_POSTGRES_VOLUME="$(existing_postgres_volume_name)"
  if [[ -n "$EXISTING_POSTGRES_VOLUME" ]]; then
    echo
    echo "Existing bundled PostgreSQL data detected: $EXISTING_POSTGRES_VOLUME"
    echo "PostgreSQL bootstrap credentials are only applied the first time the DB is initialized."
    echo "Choose how to proceed:"
    echo "  1) Preserve existing PostgreSQL data and reuse existing credentials"
    echo "  2) Reset PostgreSQL data and reinitialize with new credentials"
    echo "  3) Cancel"
    read -r -p "Selection [1-3]: " PG_DATA_CHOICE
    case "$PG_DATA_CHOICE" in
      1)
        POSTGRES_DATA_ACTION="preserve"
        echo "Preserving existing PostgreSQL data. Reusing values from existing .env where available."
        ;;
      2)
        POSTGRES_DATA_ACTION="reset"
        echo "PostgreSQL data will be reset and reinitialized."
        ;;
      3)
        echo "Canceled."
        exit 0
        ;;
      *)
        echo "Invalid selection." >&2
        exit 1
        ;;
    esac
  fi

  POSTGRES_DB="$(prompt_with_default "PostgreSQL database name" "$DEFAULT_POSTGRES_DB")"
  POSTGRES_USER="$(prompt_with_default "PostgreSQL username" "$DEFAULT_POSTGRES_USER")"

  if [[ "$POSTGRES_DATA_ACTION" == "preserve" ]]; then
    if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
      echo "Using the existing PostgreSQL password from .env because data is being preserved."
    else
      echo "Error: PostgreSQL data is being preserved, but no existing POSTGRES_PASSWORD was found in .env." >&2
      echo "Either restore the correct .env, or choose the reset/reinitialize option." >&2
      exit 1
    fi
  else
    read -r -s -p "PostgreSQL password (leave blank to auto-generate): " POSTGRES_PASSWORD
    echo
    if [[ -z "$POSTGRES_PASSWORD" ]]; then
      POSTGRES_PASSWORD="$(random_secret)"
    fi
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  read -r -p ".env already exists. Overwrite it? [y/N]: " OVERWRITE_ENV
  OVERWRITE_ENV="$(printf '%s' "$OVERWRITE_ENV" | tr '[:upper:]' '[:lower:]')"
  if [[ "$OVERWRITE_ENV" != "y" && "$OVERWRITE_ENV" != "yes" ]]; then
    echo "Aborting without modifying existing .env"
    exit 1
  fi
fi

cat > "$ENV_FILE" <<EOF
# Generated by install.sh
MATRIX_INSTALL_MODE=${INSTALL_MODE}
MATRIX_ACTIVE_DB_TYPE=${INSTALL_MODE}
MATRIX_AUTH_USERNAME=${ADMIN_USERNAME}
MATRIX_AUTH_PASSWORD=${ADMIN_PASSWORD}
MATRIX_AUTH_SECRET=${MATRIX_AUTH_SECRET}
MATRIX_APP_PORT=${APP_PORT}
MATRIX_BASE_URL=${MATRIX_BASE_URL}
MATRIXMANAGER_VERSION=${MATRIXMANAGER_VERSION}
MATRIX_SQLITE_PATH=${MATRIX_SQLITE_PATH}
MATRIX_CONTROL_DB_PATH=${MATRIX_CONTROL_DB_PATH}
MATRIX_TS_DATA_DB_PATH=${MATRIX_TS_DATA_DB_PATH}
MATRIX_TS_CONTROL_DB_PATH=${MATRIX_TS_CONTROL_DB_PATH}
POSTGRES_HOST=${POSTGRES_HOST}
POSTGRES_PORT=${POSTGRES_PORT}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_SSLMODE=${POSTGRES_SSLMODE}
EOF

cd "$ROOT_DIR"

if [[ "$INSTALL_MODE" == "postgresql" && "$POSTGRES_DATA_ACTION" == "reset" ]]; then
  echo "Resetting existing bundled PostgreSQL data before reinstall..."
  docker compose --profile postgres down -v --remove-orphans || true
  rm -f "$DATA_APP_DIR"/* 2>/dev/null || true
fi

if [[ "$INSTALL_MODE" == "postgresql" ]]; then
  echo "Starting Matrix Manager with bundled PostgreSQL..."
  docker compose --profile postgres up -d --build
else
  echo "Starting Matrix Manager with SQLite..."
  docker compose up -d --build
fi

echo "Waiting for app health endpoint..."
if ! wait_for_http "http://127.0.0.1:${APP_PORT}/health" 60 2; then
  echo "Error: Matrix Manager did not become healthy in time." >&2
  echo
  echo "Try:" >&2
  echo "  docker compose ps" >&2
  echo "  docker compose logs app --tail=100" >&2
  if [[ "$INSTALL_MODE" == "postgresql" ]]; then
    echo "  docker compose logs postgres --tail=100" >&2
  fi
  exit 1
fi

if [[ "$SEED_STARTER_DATA" == "yes" ]]; then
  echo "Seeding starter data..."
  COOKIE_JAR="$(mktemp)"
  cleanup_cookie_jar() {
    rm -f "$COOKIE_JAR"
  }
  trap cleanup_cookie_jar EXIT
  LOGIN_STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --cookie-jar "$COOKIE_JAR" \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "username=${ADMIN_USERNAME}" \
    --data-urlencode "password=${ADMIN_PASSWORD}" \
    --data-urlencode 'next=/' \
    "http://127.0.0.1:${APP_PORT}/login")"
  if [[ "$LOGIN_STATUS" != "302" ]]; then
    echo "Error: installer could not sign in to seed starter data (HTTP $LOGIN_STATUS)." >&2
    exit 1
  fi
  SEED_STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    --request POST \
    "http://127.0.0.1:${APP_PORT}/seed-default-data")"
  if [[ "$SEED_STATUS" != "200" ]]; then
    echo "Error: starter data seeding failed (HTTP $SEED_STATUS)." >&2
    exit 1
  fi
  rm -f "$COOKIE_JAR"
  trap - EXIT
fi

echo
printf 'Install complete.\n\n'
printf 'URL: %s\n' "$MATRIX_BASE_URL"
printf 'Login page: %s/login\n' "$MATRIX_BASE_URL"
printf 'Admin username: %s\n' "$ADMIN_USERNAME"
if [[ "$GENERATED_ADMIN_PASSWORD" == "yes" ]]; then
  printf 'Admin password (generated): %s\n' "$ADMIN_PASSWORD"
else
  printf 'Admin password: [user-supplied]\n'
fi
printf 'Install mode: %s\n' "$INSTALL_MODE"
printf 'Config file: %s\n' "$ENV_FILE"
printf 'SQLite data dir: %s\n' "$DATA_SQLITE_DIR"
printf 'App data dir: %s\n' "$DATA_APP_DIR"
printf 'Backups dir: %s\n' "$DATA_BACKUPS_DIR"
printf '\nUseful commands:\n'
printf '  ./manager.sh status\n'
printf '  ./manager.sh start\n'
printf '  ./manager.sh stop\n'
printf '  ./manager.sh reset\n'
printf '  ./uninstall.sh\n'
printf '  docker compose logs app --tail=100\n'
if [[ "$INSTALL_MODE" == "postgresql" ]]; then
  printf '  docker compose --profile postgres logs postgres --tail=100\n'
fi
