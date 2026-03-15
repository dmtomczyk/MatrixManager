# MatrixManager

**Plan workforce capacity and allocations across flexible hierarchies — focused on staffing and timephasing human capital, not detailed project planning.**

MatrixManager is a staffing and resource-planning web app for tracking organizations, employees, projects, and time-phased assignments. It uses a FastAPI + SQLModel backend with a lightweight browser UI for planning, canvas workflows, audit history, and database management. It now runs with PostgreSQL as the default database, with SQLite still available as an alternate runtime mode.

## Table of contents

- [Production install](#production-install)
- [Build from source](#build-from-source)
- [What the app includes](#what-the-app-includes)
- [Demo / screenshots](#demo--screenshots)
- [Dependency manifest](#dependency-manifest)

## Production install

If you want the fastest install path, use the included lifecycle scripts:

```bash
cd matrixmanager
./install.sh
./start.sh
```

Useful follow-up commands:

```bash
./status.sh
./stop.sh
./reset.sh
./uninstall.sh
```

If you want to inspect settings first, check:

- `.env.example`
- `docker-compose.yml`
- `install.sh`

## Build from source

If you want to run it directly in a local dev environment:

### 1) Install dependencies

```bash
cd matrixmanager
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure a simple local runtime

```bash
export MATRIX_INSTALL_MODE=postgresql
export MATRIX_ACTIVE_DB_TYPE=postgresql
export MATRIX_AUTH_USERNAME=admin
export MATRIX_AUTH_PASSWORD='change-me-now'
export MATRIX_AUTH_SECRET='replace-with-a-long-random-secret'
export MATRIX_APP_PORT=8000
export MATRIX_BASE_URL='http://127.0.0.1:8000'
export MATRIX_SQLITE_PATH="$PWD/matrix.db"
export MATRIX_CONTROL_DB_PATH="$PWD/matrixmanager_control.db"
```

Or copy `.env.example` to `.env` and edit it. If you want a lightweight local-only setup instead, switch both values back to `sqlite` and keep the SQLite path variables.

### 3) Run the app

```bash
uvicorn app.main:app --reload
```

Then open:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/docs`

If auth is enabled, browser requests will redirect to `/login` until you sign in.

## What the app includes

- authentication via login page and signed session cookie
- organizations, employees, projects, and assignments CRUD
- staffing/planning views
- visual canvas workflow
- project dashboard
- audit log
- database management UI
- SQLite + PostgreSQL support
- Docker / docker-compose support
- reset/seed scripts for local development

## Demo / screenshots

MatrixManager currently centers around a few core workflows:

- **Planning view** — review staffing and allocation across projects
- **Canvas workflow** — visualize and adjust staffing in a more spatial/project-centric layout
- **People + project management** — maintain employees, organizations, projects, and assignments
- **Audit + DB management** — track changes and manage active database connections

If you are evaluating the app quickly, these are the best places to start after sign-in:

- `/` or `/planning`
- `/canvas`
- `/audit`
- `/db-management`

> Screenshots can be added later, but this is the current demo path through the app.

## Dependency manifest

For a human-readable dependency inventory with rationale, production/dev split, runtime-mode notes, and an easy dependency tree, see:

- [`dependencies.md`](./dependencies.md)

---

If you are opening this repo for the first time, start with either:

- **Production-style install:** `./install.sh && ./start.sh`
- **Source/dev install:** create `.venv`, install `requirements.txt`, set env vars, then run `uvicorn app.main:app --reload`
