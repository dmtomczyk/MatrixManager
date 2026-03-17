# TS-First Runtime and Test Audit — 2026-03-17

This pass audits the remaining Docker/install/runtime surface and the legacy Python test suite now that MatrixManager is effectively a **TypeScript-first app in development**.

## Executive summary

Two things are true at once:

1. **Development is already TS-first.** `npm run dev` starts the TS API plus Vite UI, and Playwright already exercises that stack.
2. **Install/runtime packaging is still Python-first.** The shipped Dockerfile, compose file, and lifecycle scripts boot the legacy FastAPI app, not the TS API.

That means the repo currently has a split brain:
- **dev/test path:** mostly TypeScript
- **installer/container path:** still Python

So the right cleanup move is **not** “delete everything Python immediately.” The right move is:
- keep the runtime shell scripts temporarily
- port container/runtime packaging deliberately to the TS API
- then delete Python runtime artifacts in a single coherent pass

---

## 1. Docker / install / runtime audit

### Classification legend
- **Keep for now**: still operationally required
- **Port next**: preserve intent, but rewrite around the TS runtime
- **Delete after port**: remove once TS-native replacement exists
- **Delete now**: safe low-risk cleanup

### `Dockerfile`
**Current role:** builds/runs the legacy Python/FastAPI app via `uvicorn app.main:app`.

**Status:** `PORT NEXT -> DELETE AFTER PORT`

**Why:**
- it is the current containerized runtime entrypoint
- but it is completely misaligned with the current TS-first repo direction
- a future TS Dockerfile should build the UI, compile/run the TS API, and stop copying `app/` or `requirements.txt`

**TS-first replacement target:**
- Node-based image
- install root + `api/` dependencies
- build `frontend/ui`
- build or run the TS API
- expose the TS server on port 8000

### `docker-compose.yml`
**Current role:** orchestrates the Python app container plus optional Postgres.

**Status:** `PORT NEXT -> DELETE AFTER PORT`

**Why:**
- still useful operational glue
- but the `app` service is built around the Python Dockerfile and Python health surface
- env naming is partly reusable, service intent is reusable, implementation is not

**TS-first replacement target:**
- keep the service shape and data mounts if still useful
- point `app` to a TS-native image/command
- re-validate whether the optional bundled Postgres profile is still needed versus SQLite-first packaging

### `install.sh`
**Current role:** interactive installer for the containerized deployment path.

**Status:** `KEEP FOR NOW, THEN PORT`

**Why:**
- user-facing entrypoint still matters
- workflow logic (env generation, seeding toggle, health wait, postgres preserve/reset flow) is still valuable
- but it assumes the Python container is the production app

**Port notes:**
- preserve the UX and data-handling rules
- change the runtime assumptions to TS app startup and TS-native seed/reset commands
- once ported, this file can either be updated in place or replaced with a slimmer TS-first installer

### `start.sh`, `stop.sh`, `status.sh`
**Current role:** thin lifecycle wrappers over docker compose.

**Status:** `KEEP FOR NOW, THEN PORT LIGHTLY`

**Why:**
- these scripts are mostly runtime-agnostic wrappers
- they remain useful if compose survives
- only messaging/health assumptions need adjustment after the TS container path lands

**Port notes:**
- `status.sh` should keep checking `/health`, assuming the TS API maintains that contract
- `start.sh`/`stop.sh` likely survive with minimal edits if compose remains the packaging mechanism

### `reset.sh`
**Current role:** wipes SQLite/control DB/bundled Postgres volume data.

**Status:** `KEEP FOR NOW, THEN PORT/REVIEW`

**Why:**
- concept still needed
- implementation is mostly data-path oriented, not Python-specific
- but it should be reviewed once the TS runtime owns all persistence conventions

### `uninstall.sh`
**Current role:** removes containers and optionally deletes data + `.env`.

**Status:** `KEEP FOR NOW, THEN PORT/REVIEW`

**Why:**
- uninstall behavior is still useful
- largely packaging-oriented rather than app-language-specific
- should be kept until the deployment story changes

### `scripts/lifecycle-common.sh`
**Current role:** shared compose/runtime helpers for the shell scripts.

**Status:** `KEEP FOR NOW, PORT WITH SHELL SCRIPTS`

**Why:**
- this is good shared script structure
- not inherently Python-specific
- should survive as long as compose + shell lifecycle remain part of the shipping story

### `requirements.txt`
**Current role:** Python runtime + Python test dependency manifest.

**Status:** `KEEP TEMPORARILY -> SPLIT OR DELETE`

**Why:**
- currently required by the legacy Dockerfile
- currently also carries Python test deps (`pytest`, `httpx`)
- this is now a mixing bowl of runtime and test concerns for a stack we are deprecating

**Recommended next step:**
- do **not** add anything new here
- once Python tests are retired, remove test-only deps first if any Python runtime remains
- once the Python runtime path is gone, delete the file entirely

### Related docs under `requirements/` and installer planning docs
**Status:** `KEEP AS HISTORICAL REFERENCE, THEN ARCHIVE/DELETE`

**Why:**
- these documents describe how the original installer/container path was built
- they are useful reference while porting the installer
- but they should not keep acting like the living source of truth after a TS runtime port

**Recommendation:**
- once the TS-native runtime port lands, move these to a legacy/archive section or delete them

### `.dockerignore`
**Current role:** excludes a lot of build context, including `requirements/`, `tests/`, and `e2e/`.

**Status:** `KEEP, BUT REVIEW DURING PORT`

**Why:**
- it is fine for the current Python image
- but a TS-native image may need a different ignore strategy, especially around frontend build inputs and possibly test/smoke assets

---

## 2. Legacy Python test suite audit

### Files
- `tests/conftest.py`
- `tests/test_api_requirements.py`
- `tests/test_ui_surfaces.py`

### What the Python tests currently do

The Python suite is a **FastAPI TestClient + SQLModel in-process harness**. It validates:
- auth bootstrap/login
- organizations/employees/projects/assignments CRUD
- schedule endpoints
- rendered page HTML marker presence
- some hierarchy/canvas-facing payload behavior

### Why it is legacy now

These tests directly import `app.main` and mutate Python runtime globals. That means they validate the old backend implementation, not the current default TS stack.

So even when they still pass, they increasingly answer the wrong question:
- **"Does the old reference backend still work?"**
- rather than
- **"Does the shipped TS-first app still work?"**

### What already replaced part of their value

The Playwright suite in `e2e/` already runs against `npm run dev`, which means:
- TS API
- Vite UI
- browser-visible flows

That makes Playwright the correct center of gravity for ongoing automated coverage.

### Gaps versus the Python suite

The Python suite still has some advantages:
- faster in-process CRUD checks
- narrower API-level assertions without browser UI steps
- no dependency on browser rendering

### TS-first replacement strategy

#### Tier 1 — keep/expand Playwright as the source of truth
Use Playwright for:
- sign-in and route availability
- UI-backed CRUD flows
- planning/canvas/staffing critical workflows
- regression checks for rendered TS-first surfaces

#### Tier 2 — add request-driven Playwright smoke/API checks
Use Playwright's API request support for:
- `/health`
- CRUD smoke checks
- schedule endpoint assertions
- other high-value API contracts

This gives us TS-stack API validation without resurrecting a separate Python test harness.

#### Tier 3 — only add lower-level TS route/unit tests if speed becomes a bottleneck
If needed later:
- add Fastify injection tests or service/repository tests under `api/`
- but do that only for speed or precision, not out of nostalgia for pytest

### Deletion threshold for Python tests

The Python suite can be removed when all three are true:

1. Playwright/request-based TS tests cover the CRUD + schedule smoke cases
2. browser-facing routes/pages have at least smoke coverage in TS-first tests
3. CI/default local test guidance no longer points at pytest as the main safety net

---

## 3. Concrete keep / port / delete table

| File / area | Classification | Notes |
| --- | --- | --- |
| `Dockerfile` | Port next, then delete/replace | Python runtime entrypoint; must become Node/TS-based |
| `docker-compose.yml` | Port next, then replace | Compose shape useful, Python app service is not |
| `install.sh` | Keep for now, port soon | UX still useful, runtime assumptions outdated |
| `start.sh` | Keep for now | likely survives with minor TS runtime updates |
| `stop.sh` | Keep for now | likely survives with minor TS runtime updates |
| `status.sh` | Keep for now | keep `/health`, verify TS runtime contract |
| `reset.sh` | Keep for now | review data-path assumptions after runtime port |
| `uninstall.sh` | Keep for now | largely packaging-oriented |
| `scripts/lifecycle-common.sh` | Keep for now | reusable shell/runtime abstraction |
| `requirements.txt` | Keep temporarily, then delete | still backs legacy Docker/test path |
| `requirements/` docs | Keep temporarily as reference | archive/delete after TS runtime port |
| `tests/` Python suite | Replace, then delete | validates old backend, not default stack |
| `e2e/` Playwright suite | Keep and expand | already closest to the shipped app |

---

## 4. Recommended next deletions

### Safe immediately
- `tests/__pycache__/`
- `.pytest_cache/`
- any committed `.pyc` artifacts

### After one more TS-first testing pass
- `tests/conftest.py`
- `tests/test_api_requirements.py`
- `tests/test_ui_surfaces.py`
- remove `pytest` and `httpx` from Python dependency guidance if nothing else needs them

### After TS runtime packaging lands
- legacy Python `Dockerfile`
- Python-oriented `docker-compose.yml` service definition
- `requirements.txt`
- remaining legacy backend runtime docs

---

## 5. Practical next step order

1. **Add TS-first smoke coverage** for health/auth/pages/basic CRUD using Playwright request/browser APIs
2. **Mark Python tests as legacy reference coverage** rather than primary verification
3. **Port Dockerfile + compose to TS runtime**
4. **Remove Python tests and pytest dependency surface**
5. **Delete legacy Python runtime packaging files** once no longer used

## Bottom line

The most misleading remaining artifacts are no longer the Python source files themselves — they are the files that still make the repo look like a Python-shipping product:
- `Dockerfile`
- `docker-compose.yml`
- `requirements.txt`
- `tests/`

Development has already moved on. Packaging and test labeling need to catch up.
