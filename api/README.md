# MatrixManager TypeScript API

This folder is the long-term replacement for the legacy Python backend.

## Goals

- stable TypeScript-first backend runtime
- explicit config loading and validation
- route-by-route migration instead of a flag day rewrite
- clean separation between app concerns and installer/runtime concerns

## Initial stack

- Fastify
- Zod for configuration validation
- TypeScript + tsx for local dev

## Migration stance

The legacy Python app remains in place while routes move over in slices.
Do not pretend this folder is feature-complete yet.

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

- `npm run dev:api:ts`
- `npm run typecheck:api`
- `npm run build:api`

Or directly inside `api/`:

- `npm install`
- `npm run dev`
