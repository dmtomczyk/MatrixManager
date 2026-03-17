# MatrixManager TypeScript API

This folder is now the primary in-repo backend for MatrixManager.

## Goals

- stable TypeScript-first backend runtime
- explicit config loading and validation
- route-by-route migration instead of a flag day rewrite
- clean separation between app concerns and installer/runtime concerns

## Initial stack

- Fastify
- Zod for configuration validation
- TypeScript + tsx for local dev

## Current stance

The TypeScript app is now the primary development/runtime path inside the repo.
The legacy Python backend remains temporarily for comparison and staged cleanup only.

## Suggested migration order

1. health + runtime metadata
2. auth/session endpoints
3. organizations + job codes
4. employees
5. projects
6. assignments + approval actions
7. dashboard/inbox/runtime/admin surfaces
8. HTML shell decommissioning or replacement

## Current commands

From repo root:

- `npm run dev`
- `npm run dev:api:ts`
- `npm run typecheck:api`
- `npm run build:api`

Or directly inside `api/`:

- `npm install`
- `npm run dev`
