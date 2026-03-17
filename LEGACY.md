# LEGACY.md

Legacy Python/FastAPI stack status for MatrixManager.

## Current default

The TypeScript stack is now the primary development path.

Use:

- `npm run dev` → TypeScript API + Vite UI

## Legacy path

The old Python backend is still present temporarily for reference and comparison in source form, but it is no longer exposed as a normal local dev script.

## Why this file exists

The repository has completed enough parity work that the legacy stack should no longer be treated as the default center of gravity.

The Python backend remains in-repo only to support:

- behavior comparison during cleanup
- edge-case reference while finishing deprecation
- the still-unported Docker/install runtime packaging path
- staged removal instead of risky one-shot deletion

## Rule of thumb

- build new behavior in the TypeScript stack
- do not add new features to the legacy backend
- remove legacy-only paths once confidence is high and any remaining reference value is gone
