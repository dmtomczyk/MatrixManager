# MatrixManager

MatrixManager is a staffing and resource-planning web app for tracking organizations, employees, projects, and time-phased assignments. It combines a FastAPI + SQLModel backend with a lightweight browser UI for planning views, canvas workflows, audit history, and database management. It can run with SQLite by default or PostgreSQL when you need a more deployment-oriented setup.

## Table of contents

- [Production install](#production-install)
- [Build from source](#build-from-source)
- [What the app includes](#what-the-app-includes)
- [Database modes](#database-modes)
- [Docker / docker-compose](#docker--docker-compose)
- [Lifecycle scripts](#lifecycle-scripts)
- [Development scripts](#development-scripts)
- [Dependency manifest](#dependency-manifest)
- [Notes for contributors](#notes-for-contributors)

## Production install

If you want the fastest install path, use the included lifecycle scripts.

```bash
cd matrixmanager
./install.sh
./start.sh
```

Useful companion commands:

```bash
./status.sh
./stop.sh
./reset.sh
./uninstall.sh
```

What this path is for:

- guided/bootstrap-style install
- `.env`-driven runtime configuration
- containerized app startup
- easier repeatable deployment on a host running Docker Compose

If you want to inspect or change settings first, review:

- `.env.example`
- `docker-compose.yml`
- `install.sh`

## Build from source

If you want to run it directly in a local dev environment:

### 1) Create a virtual environment and install Python dependencies

```bash
cd matrixmanager
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure runtime

For a simple local SQLite setup:

```bash
export MATRIX_INSTALL_MODE=sqlite
export MATRIX_ACTIVE_DB_TYPE=sqlite
export MATRIX_AUTH_USERNAME=admin
export MATRIX_AUTH_PASSWORD='change-me-now'
export MATRIX_AUTH_SECRET='replace-with-a-long-random-secret'
export MATRIX_APP_PORT=8000
export MATRIX_BASE_URL='http://127.0.0.1:8000'
export MATRIX_SQLITE_PATH="$PWD/matrix.db"
export MATRIX_CONTROL_DB_PATH="$PWD/matrixmanager_control.db"
```

Or copy `.env.example` to `.env` and adjust values there.

### 3) Run the app

```bash
uvicorn app.main:app --reload
```

Open:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/docs`

If auth is enabled, browser requests will redirect to `/login` until you sign in.

## What the app includes

The current repository includes these major capabilities:

- **Authentication** via login page and signed session cookie
- **Organizations** CRUD
- **Employees** CRUD, including manager relationships and capacity
- **Projects** CRUD with optional dates and descriptions
- **Assignments** CRUD with time windows, allocation, and notes
- **Planning views** for staffing and schedule visibility
- **Canvas view** for spatial/project-centered staffing workflows
- **Project dashboard** page
- **Audit log** UI and backend tracking
- **Database management** UI for managing and activating DB connection profiles
- **SQLite + PostgreSQL support**
- **OpenAPI docs** at `/docs`
- **pytest + Playwright coverage**
- **Reset and seed scripts** for local development
- **Docker / docker-compose** runtime support

## Database modes

### SQLite

SQLite is the default and simplest option for local use and quick evaluation.

Typical flow:

```bash
cd matrixmanager
source .venv/bin/activate
uvicorn app.main:app --reload
```

### PostgreSQL

PostgreSQL is supported through runtime configuration and the included Compose setup. The app also includes a `/db-management` UI for managing and activating database connection profiles.

## Docker / docker-compose

A container workflow is already included.

### Run the app with SQLite-backed volumes

```bash
cd matrixmanager
docker compose up --build
```

This uses:

- `.env`
- app container on `${MATRIX_APP_PORT:-8000}`
- mounted data directories:
  - `./data/sqlite:/data/sqlite`
  - `./data/app:/data/app`

### Run with the PostgreSQL profile enabled

```bash
cd matrixmanager
docker compose --profile postgres up --build
```

The Compose setup also includes:

- app healthcheck on `/health`
- optional PostgreSQL service with persistent volume

## Lifecycle scripts

For the containerized install/deploy workflow:

```bash
cd matrixmanager
./install.sh
./start.sh
./stop.sh
./status.sh
./reset.sh
./uninstall.sh
```

Script summary:

- `install.sh` — guided install/bootstrap and `.env` generation
- `start.sh` — start the Compose stack with the correct profile
- `stop.sh` — stop the stack while preserving data
- `status.sh` — show Compose status plus a host-side health probe
- `reset.sh` — wipe MatrixManager data while keeping config/scripts
- `uninstall.sh` — remove runtime, with an option to keep or delete data

## Development scripts

### Reset the database

```bash
cd matrixmanager
python scripts/reset_db.py
# or
npm run db:reset
```

### Seed sample data

```bash
cd matrixmanager
python scripts/seed_sample_data.py
# or
npm run db:seed
```

The seeder recreates a clean sample dataset with organizations, hierarchy, projects, and assignments.

## API overview

FastAPI exposes interactive API docs at:

- `/docs`

The core resource families documented by the current app domain are:

- `/organizations`
- `/employees`
- `/projects`
- `/assignments`
- `/schedule/employee/{id}`
- `/schedule/project/{id}`

The backend also includes auth, audit, and database-management-related behavior used by the UI.

## Dependency manifest

For a human-readable dependency inventory with rationale, production/dev split, runtime-mode notes, and an easy dependency tree, see:

- [`dependencies.md`](./dependencies.md)

## Requirements and coverage tracking

The repo includes product and QA artifacts under `requirements/`:

- `requirements.csv`
- `requirements_test_plan.csv`
- `tp_coverage_matrix.csv`
- phase planning / installer documents

These are useful for understanding scope, delivery planning, and current test coverage status.

## Notes for contributors

- The backend entrypoint is `app/main.py`
- The frontend lives under `app/static/`
- SQLite is the easiest local iteration path
- Docker/Compose and lifecycle scripts are already included for more deployment-like usage
- The project now has enough surface area that route-level docs and screenshots would add real value

---

If you are opening this repo for the first time, start with either:

- **Production-style install:** `./install.sh && ./start.sh`
- **Source/dev install:** create `.venv`, install `requirements.txt`, set env vars, then run `uvicorn app.main:app --reload`
