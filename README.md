# MatrixManager

**Plan workforce capacity and allocations across flexible hierarchies — focused on staffing and timephasing human capital, not detailed project planning.**

MatrixManager is a staffing and resource-planning web app for tracking organizations, employees, projects, and time-phased assignments. The primary in-repo development stack is now a TypeScript API plus React/Vite UI. The remaining legacy Python/FastAPI backend is retained only as a temporary reference during staged cleanup.

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
./manager.sh start
```

Useful follow-up commands:

```bash
./manager.sh status
./manager.sh stop
./manager.sh reset
./uninstall.sh
```

This install/runtime path now boots the shipped **TypeScript/Fastify container runtime** and persists the TS data/control SQLite files under `./data/`.

If you want to inspect settings first, check:

- `.env.example`
- `docker-compose.yml`
- `install.sh`

## Build from source

If you want to run it directly in a local dev environment:

### Primary dev path: TypeScript stack

Install dependencies:

```bash
cd matrixmanager
npm install
cd api && npm install && cd ..
```

Then run the current primary dev stack:

```bash
npm run dev
```

This starts:

- TypeScript API
- Vite frontend dev server

Then open:

- `http://127.0.0.1:8000/`

### Environment

Copy `.env.example` to `.env` and edit it as needed.

For local development, the TypeScript stack uses the repo-local TS persistence files by default and prefers the Vite frontend dev server in development mode.

### Legacy reference path

The old Python backend is no longer part of the normal local development flow.
If you still need to inspect the remaining legacy implementation files during cleanup, treat them as reference material only.

See [`LEGACY.md`](./LEGACY.md) for the current deprecation/removal status, and `docs/ts-first-runtime-and-test-audit-2026-03-17.md` for the runtime/test migration audit.

## What the app includes

- authentication via login page and signed session cookie
- organizations, employees, projects, assignments, and job code CRUD
- staffing/planning views
- visual canvas workflow
- dashboard + forecast views
- audit log
- database management UI
- TypeScript API with SQLite-backed migrated persistence
- Docker / docker-compose support for the TypeScript/Fastify runtime
- TypeScript-first automated coverage via Fastify injection + Playwright smoke coverage
- remaining legacy Python backend retained temporarily for staged cleanup

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

- **Production-style install:** `./install.sh && ./manager.sh start`
- **Source/dev install:** `npm install && (cd api && npm install) && npm run dev`
- **TS API integration tests:** `npm run test:api`
- **TS-first smoke test:** `npm run test:e2e:smoke`
