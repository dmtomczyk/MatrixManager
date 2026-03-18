# LEGACY.md

Legacy removal status for MatrixManager.

## Current default

The TypeScript stack is the active development and runtime path.

Use:

- `npm run dev` → TypeScript API + Vite UI

## Removed legacy surface

The old Python/FastAPI backend source and the old static multi-page legacy UI bundle have been removed from the repository.

## Rule of thumb

- build new behavior in the TypeScript stack
- keep docs and tooling aligned to the TypeScript runtime
