# Legacy Cleanup Inventory — 2026-03-17

This document records the legacy cleanup milestone reached on 2026-03-17.

## Current repo posture

- **Primary stack:** TypeScript API + React/Vite UI
- **Legacy Python backend:** removed from the repository
- **Legacy static multi-page UI:** removed from the repository
- **Legacy migration/planning requirement docs:** removed from the repository
- **Legacy JS Playwright specs for the pre-React UI:** removed from the repository

## What remains

The repository now centers on:
- `api/` for the TypeScript backend
- `frontend/ui/` for the React UI
- Docker/install lifecycle files for the shipped TypeScript runtime
- current TypeScript API tests and TS-first smoke coverage

## Notes

The repository has been normalized around the TypeScript runtime, including the active SQLite database naming used by the current API and install flow.
