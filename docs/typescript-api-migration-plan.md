# TypeScript API Migration Plan

## Decision

MatrixManager will migrate its backend from the current Python/FastAPI implementation to a TypeScript backend living in `api/` at the repository root.

## Why

Recent backend failures showed that the current runtime is too brittle around:

- local vs container config behavior
- import-time side effects
- hidden startup assumptions
- monolithic backend layout in `app/main.py`

The target is a more maintainable backend with clearer boundaries and a better day-to-day dev experience.

## Target architecture

```text
api/
  src/
    index.ts            # process entrypoint
    app.ts              # app factory + plugin registration
    config.ts           # env loading + validation
    plugins/            # db/auth/logging plugins
    routes/             # route modules grouped by feature
    services/           # business logic
    repositories/       # persistence layer
    schemas/            # zod/domain contracts
    lib/                # shared helpers
```

## Ground rules

- keep the new backend in `api/`
- migrate route-by-route, not via a one-shot rewrite
- avoid reproducing the legacy monolith in TypeScript
- installer/runtime concerns should feed the app contract, not define app internals
- prefer explicit typed config over ad hoc `process.env` access throughout the codebase

## Phase 1: scaffold and stabilize

- [x] create `api/` TypeScript service skeleton
- [x] add config loading + validation
- [x] add health and runtime metadata routes
- [ ] add package install in `api/`
- [ ] choose persistence layer (recommended: Kysely or Drizzle)
- [ ] add test harness and route smoke tests

## Phase 2: auth boundary

- [ ] port `/login`, `/logout`, and session handling
- [ ] port current-user boot props contract needed by the React UI
- [ ] define cookie/session abstraction separate from route handlers

## Phase 3: core domain APIs

Suggested order:

1. organizations
2. job codes
3. employees
4. projects
5. demands
6. assignments

## Phase 4: operational/admin APIs

- [ ] dashboard
- [ ] inbox
- [ ] audit log
- [ ] runtime overview
- [ ] DB connection management
- [ ] account settings
- [ ] users

## Route inventory from legacy Python backend

### HTML / navigation
- `/login`
- `/`
- `/planning`
- `/demands`
- `/people`
- `/staffing`
- `/canvas`
- `/forecast`
- `/dashboard`
- `/inbox`
- `/account-settings`
- `/orgs`
- `/job-codes`
- `/audit`
- `/users`
- `/db-management`
- `/runtime`

### API / actions
- `/health`
- `/health/ready`
- `/health/details`
- `/seed-default-data`
- `/login`
- `/logout`
- `/job-codes-api`
- `/organizations`
- `/employees`
- `/demands-api`
- `/projects`
- `/assignments`
- `/schedule/employee/:employeeId`
- `/schedule/project/:projectId`
- `/runtime-overview`
- `/runtime-errors`
- `/runtime-error-groups`
- `/runtime-health-snapshots`
- `/audit-log`
- `/inbox-api`
- `/users-api`
- `/account-settings-api`
- `/dashboard-api`
- `/db-connections`
- `/db-management/wipe-data-db`

## Root script strategy

During migration, keep both worlds available:

- legacy Python backend for current feature completeness
- TypeScript backend for forward migration work

Do not switch the default app runtime until auth + core CRUD surfaces are ported.
