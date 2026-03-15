# MatrixManager Dependencies

A human-readable dependency manifest for release planning, maintenance, and version review.

This file is intentionally **not** a lockfile and **not** a package-manager replacement. It exists to document:

- core runtime requirements
- dev/test-only requirements
- SQLite vs PostgreSQL differences
- why each dependency exists
- what should stay pinned for stable releases

---

## [project]

```toml
name = "matrixmanager"
version = "0.1.0"
language = ["python", "javascript"]
python_runtime = "3.12-slim-bookworm (Docker)"
node_runtime = ">=18 (Playwright tooling)"
default_database = "sqlite"
optional_database = "postgresql"
```

## [dependency-policy]

```toml
python_direct_dependencies = "pin exact versions for releases"
python_transitive_dependencies = "review via pip freeze / lock process"
node_dev_dependencies = "prefer exact pins for release branches"
container_base_images = "review regularly; pin tighter if reproducibility becomes critical"
system_packages = "keep minimal"
```

---

## [dependencies.production]

### fastapi

```toml
name = "fastapi"
version = "0.110.0"
pin = "exact"
required_for = ["web-api", "routing", "request-handling", "docs"]
```

Why it exists:
- primary web framework
- exposes app routes and OpenAPI docs
- foundation of the browser app + API surface

Key interdependencies:
- depends on `pydantic`
- depends on `starlette`
- used alongside `uvicorn`

---

### uvicorn

```toml
name = "uvicorn"
version = "0.29.0"
pin = "exact"
required_for = ["asgi-server", "local-dev", "container-runtime"]
```

Why it exists:
- serves the FastAPI application
- used in local development and Docker runtime

Key interdependencies:
- runs `fastapi`
- depends on `click`
- depends on `h11`

---

### sqlmodel

```toml
name = "sqlmodel"
version = "0.0.14"
pin = "exact"
required_for = ["orm", "models", "db-access"]
```

Why it exists:
- defines model layer and database interaction patterns
- bridges application models with SQLAlchemy and Pydantic style usage

Key interdependencies:
- depends on `SQLAlchemy`
- depends on `pydantic`
- used for both SQLite and PostgreSQL modes

---

### psycopg[binary] (postgresql only)

```toml
name = "psycopg[binary]"
version = "3.2.9"
pin = "exact"
optional = true
database_mode = "postgresql"
required_for = ["postgres-driver", "postgresql-runtime"]
```

Why it exists:
- provides PostgreSQL driver support
- required when MatrixManager is configured to use PostgreSQL instead of SQLite

Key interdependencies:
- used by SQLAlchemy/engine construction in PostgreSQL mode
- not required for SQLite-only deployments

Current note:
- declared in `requirements.txt`
- **not currently installed in the inspected local `.venv`**

---

## [dependencies.production.transitive]

These are not declared directly in the repo’s manifest files, but are core runtime dependencies currently brought in by the production stack.

### FastAPI / model stack

```toml
pydantic = "2.12.5"
pydantic_core = "2.41.5"
starlette = "0.36.3"
typing_extensions = "4.15.0"
annotated_types = "0.7.0"
typing_inspection = "0.4.2"
SQLAlchemy = "2.0.48"
greenlet = "3.3.2"
```

### Server stack

```toml
click = "8.3.1"
h11 = "0.16.0"
```

Rationale:
- these are core runtime-enabling packages for the pinned production dependencies above
- they should be reviewed whenever `fastapi`, `uvicorn`, or `sqlmodel` are upgraded

Release guidance:
- if you want highly reproducible releases, promote these into a generated lock or constraints process

---

## [dependencies.dev]

### pytest

```toml
name = "pytest"
version = "8.3.5"
pin = "exact"
required_for = ["python-tests", "regression-tests"]
```

Why it exists:
- primary Python test runner
- used for API and UI-surface regression checks in `tests/`

Key interdependencies:
- commonly used with `httpx`
- depends on `pluggy`, `packaging`, `iniconfig`

---

### httpx

```toml
name = "httpx"
version = "0.27.2"
pin = "exact"
required_for = ["test-client", "http-testing"]
```

Why it exists:
- HTTP client used in Python-side testing workflows
- useful for API-level verification

Key interdependencies:
- depends on `httpcore`, `anyio`, `certifi`, `idna`, `sniffio`

---

### @playwright/test

```toml
name = "@playwright/test"
declared_version = "^1.53.2"
installed_version = "1.58.2"
pin = "range (currently not exact)"
required_for = ["browser-e2e", "ui-regression"]
```

Why it exists:
- end-to-end browser testing for the frontend app
- drives E2E workflows in `e2e/`

Key interdependencies:
- pulls in `playwright`
- pulls in `playwright-core`
- optional `fsevents` on macOS

Release guidance:
- this should probably be changed to an **exact pin** for release stability
- current manifest allows drift within the caret range

---

## [dependencies.dev.transitive]

### Python test transitive packages

```toml
httpcore = "1.0.9"
anyio = "4.12.1"
certifi = "2026.2.25"
idna = "3.11"
sniffio = "1.3.1"
iniconfig = "2.3.0"
packaging = "26.0"
pluggy = "1.6.0"
```

### Node test transitive packages

```toml
playwright = "1.58.2"
playwright-core = "1.58.2"
fsevents = "2.3.2" # optional, macOS-only
```

---

## [dependencies.runtime-modes]

### sqlite

```toml
mode = "default"
requires = ["fastapi", "uvicorn", "sqlmodel", "sqlite3 (stdlib)"]
```

Notes:
- simplest runtime mode
- no separate database driver package required beyond Python stdlib SQLite support
- best path for local development and quick evaluation

### postgresql

```toml
mode = "optional"
requires = ["fastapi", "uvicorn", "sqlmodel", "psycopg[binary]"]
compose_service = "postgres:16-bookworm"
```

Notes:
- requires PostgreSQL configuration in env/runtime
- Compose file includes optional Postgres service
- should be validated in CI if Postgres support is considered release-critical

---

## [dependencies.containers]

### application image

```toml
base_image = "python:3.12-slim-bookworm"
system_packages = ["curl", "ca-certificates"]
python_bootstrap_tools = ["pip", "setuptools", "wheel"]
```

Why it exists:
- containerized production/dev runtime
- `curl` is used by healthcheck flows
- `ca-certificates` supports TLS/HTTPS behavior

Release guidance:
- base image is reasonably stable, but not immutable
- pin image digest if you need stronger reproducibility
- pip/setuptools/wheel upgrades are currently not pinned

### optional database image

```toml
postgres_image = "postgres:16-bookworm"
usage = "docker compose --profile postgres up"
```

---

## [dependency-tree]

```text
MatrixManager
├─ Production
│  ├─ fastapi==0.110.0
│  │  ├─ pydantic==2.12.5
│  │  │  ├─ pydantic_core==2.41.5
│  │  │  ├─ annotated-types==0.7.0
│  │  │  └─ typing-inspection==0.4.2
│  │  ├─ starlette==0.36.3
│  │  └─ typing_extensions==4.15.0
│  ├─ uvicorn==0.29.0
│  │  ├─ click==8.3.1
│  │  └─ h11==0.16.0
│  ├─ sqlmodel==0.0.14
│  │  ├─ SQLAlchemy==2.0.48
│  │  │  └─ greenlet==3.3.2
│  │  └─ pydantic==2.12.5
│  └─ psycopg[binary]==3.2.9   [PostgreSQL only]
│
├─ Dev / Test
│  ├─ pytest==8.3.5
│  │  ├─ iniconfig==2.3.0
│  │  ├─ packaging==26.0
│  │  └─ pluggy==1.6.0
│  ├─ httpx==0.27.2
│  │  ├─ httpcore==1.0.9
│  │  ├─ anyio==4.12.1
│  │  ├─ certifi==2026.2.25
│  │  ├─ idna==3.11
│  │  └─ sniffio==1.3.1
│  └─ @playwright/test
│     ├─ declared: ^1.53.2
│     ├─ installed: 1.58.2
│     └─ playwright-core==1.58.2
│
├─ Runtime modes
│  ├─ SQLite
│  │  └─ sqlite3 (Python stdlib)
│  └─ PostgreSQL
│     ├─ psycopg[binary]
│     └─ postgres:16-bookworm (Compose profile)
│
└─ Containers / System
   ├─ python:3.12-slim-bookworm
   ├─ curl
   └─ ca-certificates
```

---

## [release-checklist]

Before cutting a release, review:

- are Python direct deps still pinned exactly?
- is `@playwright/test` pinned exactly or still floating via `^`?
- is `psycopg[binary]` installed and tested if PostgreSQL is a supported release mode?
- do transitive Python versions need a lock/constraints file?
- should Docker base image and bootstrap tooling be pinned more tightly?

## [recommended-future-cleanup]

```toml
split_python_manifests = [
  "requirements-prod.txt",
  "requirements-dev.txt",
  "requirements-postgres.txt"
]
add_constraints_or_lock = true
pin_playwright_exactly = true
validate_postgres_mode_in_ci = true
```
