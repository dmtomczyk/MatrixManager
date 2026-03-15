# Matrix Manager Phase 1 Beta Installer File-Level Implementation Plan

## Status
Draft for implementation handoff.

## Purpose
Define the concrete file-level build plan for the Phase 1 beta installer so implementation can proceed without unresolved architecture questions.

## Scope
This file covers the first implementation tranche for:
- Phase 1 — Make Runtime Deployable
- Phase 2 — Installer Skeleton
- Phase 3 — Bundled PostgreSQL Provisioning

It translates the frozen Phase 0 decisions into specific files, responsibilities, configuration contracts, and sequencing.

---

# 1. Top-Level Deliverables

## 1.1 New / Updated Files
The Phase 1 beta installer implementation should produce or update the following files.

### Runtime / packaging
1. `Dockerfile`
2. `.dockerignore`
3. `docker-compose.yml`
4. `docker-compose.sqlite.yml` *(optional if split mode is clearer than profiles)*
5. `docker-compose.postgres.yml` *(optional if split mode is clearer than profiles)*
6. `.env.example`

### Installer / lifecycle
7. `install.sh`
8. `upgrade.sh`
9. `scripts/wait-for-postgres.sh` *(optional if healthcheck/wait logic stays outside Python)*
10. `scripts/smoke-test-install.sh` *(recommended for repeatable validation)*

### Documentation
11. `requirements/deployment_layout_phase1_beta.md`
12. `requirements/runtime_env_contract_phase1_beta.md`
13. `README.md` updates for beta install path

### App/runtime updates
14. `app/main.py` updates for container-friendly configuration
15. `requirements.txt` updates as needed for runtime parity

---

# 2. Deployment Layout

## 2.1 Target Install Directory Shape
The installer should create a deployment directory with this structure:

```text
<install-dir>/
├── .env
├── docker-compose.yml
├── release/
│   └── matrixmanager/          # app bundle or checked-out release contents
├── data/
│   ├── sqlite/                # SQLite mode persistent data
│   ├── app/                   # app-owned persistent files if needed
│   └── backups/               # backup output target
└── logs/                      # optional host-side convenience path
```

## 2.2 Layout Rules
1. Installer-generated config must live in the install directory.
2. Persistent data must live outside ephemeral container layers.
3. The release contents must be replaceable during upgrade without wiping config/data.
4. The PostgreSQL data path should be a named Docker volume or a stable bind mount, with one official default chosen before implementation.

## 2.3 Recommended Decision
For beta simplicity:
- use **bind-mounted `.env` and release directory**
- use **bind mount for SQLite data**
- use **named volume for PostgreSQL data**

That gives better Docker ergonomics for PostgreSQL and easy visibility for SQLite.

---

# 3. File Responsibilities

## 3.1 `Dockerfile`
### Responsibility
Build the Matrix Manager application image.

### Must Do
1. Use a stable Python base image.
2. Install runtime dependencies from `requirements.txt`.
3. Copy app source into image.
4. Expose the application port used by uvicorn.
5. Start the app with a production-style command, not `--reload`.
6. Support environment-driven configuration.

### Expected Runtime Command
Example shape:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Notes
- Do not bake secrets into the image.
- Keep image generic enough to run in either SQLite or PostgreSQL mode.
- Assume the app image is built locally during install/deploy from bundled source, not pulled from a published Matrix Manager image registry.

---

## 3.2 `.dockerignore`
### Responsibility
Keep image builds small and deterministic.

### Must Exclude
1. `.git/`
2. `.venv/`
3. `node_modules/`
4. `test-results/`
5. local DB files
6. `__pycache__/`
7. `.pytest_cache/`
8. temporary installer output

---

## 3.3 `docker-compose.yml`
### Responsibility
Define the official beta runtime topology.

### Must Do
1. Define the `app` service.
2. Support SQLite and PostgreSQL modes via:
   - profiles, or
   - generated override files, or
   - env-driven service behavior.
3. Define healthcheck(s).
4. Define restart policy.
5. Define persistent data wiring.
6. Keep PostgreSQL private by default.

### App Service Requirements
- build locally from the release/source bundle
- read `.env`
- publish configured HTTP port
- include healthcheck against app HTTP endpoint
- depend on PostgreSQL readiness in PostgreSQL mode

### PostgreSQL Service Requirements
- use official Postgres image
- read generated DB credentials from env
- define healthcheck with `pg_isready`
- persist data via named volume
- do not publish external port by default

### Recommended Approach
Use **one Compose file with profiles** if it stays readable:
- default/always: `app`
- profile: `postgres`

If that gets messy, use:
- `docker-compose.yml`
- `docker-compose.postgres.yml`

---

## 3.4 `.env.example`
### Responsibility
Document the runtime environment contract and provide a safe template.

### Must Include
#### App auth/runtime
- `MATRIX_AUTH_USERNAME`
- `MATRIX_AUTH_PASSWORD`
- `MATRIX_AUTH_SECRET`
- `MATRIX_BASE_URL` *(if introduced)*
- `MATRIX_APP_PORT`

#### DB mode selection
- `MATRIX_INSTALL_MODE`
- `MATRIX_ACTIVE_DB_TYPE`

#### SQLite mode
- `MATRIX_SQLITE_PATH`

#### PostgreSQL mode
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_SSLMODE`

### Notes
- `.env.example` is documentation, not a production file.
- Installer writes the real `.env`.

---

## 3.5 `install.sh`
### Responsibility
Serve as the single official Phase 1 beta installer entry point.

### Must Do
1. Check prerequisites:
   - Docker installed
   - Docker Compose available
   - shell environment acceptable
2. Prompt for minimal inputs:
   - install mode
   - install directory
   - app port
   - admin password strategy
   - optional hostname/base URL
3. Create deployment directory.
4. Generate secrets.
5. Write `.env`.
6. Place/copy release files into install directory.
7. Launch the Compose stack.
8. Wait for service readiness.
9. Verify app login page responds.
10. Print success output.

### Installer Output Must Include
- URL
- username
- password or password setup result
- install dir
- data dir
- backup hint
- status/log command hint

### Must Not Require
- manual Postgres install
- manual DB creation
- manual env editing in default path

---

## 3.6 `upgrade.sh`
### Responsibility
Handle beta-to-beta upgrades without reinstalling from scratch.

### Must Do
1. Preserve `.env`.
2. Preserve volumes/data.
3. Replace release contents.
4. Rebuild/pull updated image.
5. Restart stack.
6. Run migration-compatible startup flow.
7. Print post-upgrade verification instructions.

### Can Initially Be
- scaffolded in Phase 1
- fully completed before beta release

---

## 3.7 `scripts/wait-for-postgres.sh` *(optional)*
### Responsibility
Provide explicit wait logic if Compose health/dependency rules are insufficient.

### Must Do
- retry until PostgreSQL is reachable
- fail cleanly with timeout
- print readable failure messages

### Note
If Compose healthchecks alone solve this cleanly, this file can be omitted.

---

## 3.8 `scripts/smoke-test-install.sh`
### Responsibility
Provide a repeatable post-install validation flow.

### Must Verify
1. app container is running
2. PostgreSQL container is healthy when selected
3. login page responds
4. authentication works
5. core CRUD path works at least minimally

---

## 3.9 `requirements/deployment_layout_phase1_beta.md`
### Responsibility
Document deployment directory layout, data locations, and ownership.

### Must Cover
- install directory shape
- where `.env` lives
- where SQLite lives
- where PostgreSQL persists
- where backups go
- what upgrade may replace vs preserve

---

## 3.10 `requirements/runtime_env_contract_phase1_beta.md`
### Responsibility
Define the supported environment variable contract for installer-generated deployments.

### Must Cover
- every env var name
- whether installer-generated or optional
- default value behavior
- which mode(s) it applies to
- whether users are expected to edit it manually

---

## 3.11 `app/main.py`
### Responsibility
Remain runtime-configurable and container-safe.

### Required Changes
1. Ensure app bind host/port assumptions work in containerized deployment.
2. Ensure DB selection can be driven cleanly from environment/config for installer mode.
3. Ensure bundled PostgreSQL path does not rely on manual in-app DB setup.
4. Ensure startup/migration path is deterministic in fresh container boots.
5. Ensure health endpoint or cheap readiness URL exists.

### Recommended Additional Work
- add `/health` endpoint returning 200 if app is alive
- optionally add DB connectivity check if cheap and safe

---

# 4. Environment Variable Contract (Initial)

## 4.1 Required Runtime Vars
### App
- `MATRIX_AUTH_USERNAME`
- `MATRIX_AUTH_PASSWORD`
- `MATRIX_AUTH_SECRET`
- `MATRIX_APP_PORT`
- `MATRIX_INSTALL_MODE`

### SQLite mode
- `MATRIX_SQLITE_PATH`

### PostgreSQL mode
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_SSLMODE`

## 4.2 Recommended Additional Vars
- `MATRIX_BASE_URL`
- `MATRIX_DATA_DIR`
- `MATRIX_RELEASE_VERSION`
- `MATRIX_DEPLOY_ROOT`

## 4.3 Installer Ownership
The installer owns writing these values into `.env`.
Users should not need to hand-edit them for the default install path.

---

# 5. Healthcheck Strategy

## 5.1 App Healthcheck
### Recommended
Use an HTTP endpoint such as:
- `GET /login`
or preferably
- `GET /health`

### Requirement
The endpoint must be cheap, deterministic, and not require user interaction.

## 5.2 PostgreSQL Healthcheck
Use `pg_isready` inside the postgres container.

## 5.3 Installer Success Gate
Installer success requires:
1. containers up
2. postgres healthy when selected
3. app HTTP reachable
4. login page available

---

# 6. Mode-Specific Runtime Behavior

## 6.1 SQLite Quick Start
### Compose Behavior
- only `app` service required
- SQLite file persisted on host path

### Installer Behavior
- create SQLite data path
- write SQLite-related env vars
- start app
- verify login page

## 6.2 PostgreSQL Recommended
### Compose Behavior
- `app` + `postgres`
- postgres volume persistent
- app configured via env for bundled PostgreSQL

### Installer Behavior
- generate DB credentials
- write Postgres env vars
- start postgres first via Compose
- wait for readiness
- start/verify app

---

# 7. Recommended Implementation Order

## Step 1
Create documentation scaffolds first:
1. `requirements/deployment_layout_phase1_beta.md`
2. `requirements/runtime_env_contract_phase1_beta.md`

## Step 2
Create runtime scaffolding:
1. `Dockerfile`
2. `.dockerignore`
3. Compose definition(s)

## Step 3
Add app runtime hooks:
1. health endpoint
2. environment-driven DB bootstrap path
3. production startup command assumptions

## Step 4
Create installer scaffold:
1. `install.sh`
2. `.env.example`
3. directory creation logic
4. readiness verification logic

## Step 5
Create validation scaffold:
1. `scripts/smoke-test-install.sh`
2. manual validation checklist

## Step 6
Create upgrade scaffold:
1. `upgrade.sh`

---

# 8. Open Implementation Questions
These are allowed implementation questions, but not architecture blockers.

1. Should Compose mode selection use profiles or generated override files?
2. Should PostgreSQL persistence use named volumes only, or optional bind mounts?
3. Should admin password be prompted or auto-generated by default?

## Current Recommendation
1. Prefer **profiles** if readable.
2. Use **named volume** for PostgreSQL.
3. Default to **prompt with auto-generate fallback**.

---

# 9. Definition of Done for This Plan
This file-level implementation plan is complete when:

1. every Phase 1/2/3 P0 deliverable maps to concrete files
2. each file has an explicit responsibility
3. env/config ownership is defined
4. healthcheck strategy is defined
5. implementation can begin without reopening Phase 0 decisions
