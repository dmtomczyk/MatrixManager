# MatrixManager TS parity audit and execution plan

Date: 2026-03-16

## Audit summary

Current TypeScript migration state in `matrixmanager/`:

- **TS backend exists** under `api/src` with Fastify auth, health, and partial workforce CRUD.
- **Unified TS React UI exists** under `frontend/ui`, but only actively renders:
  - `/login`
  - `/` (Get Started)
  - `/canvas`
- **Server-rendered TS HTML pages** exist for:
  - `/orgs`
  - `/people`
- **Missing / incomplete parity**:
  - Workforce pages are create-only in page UI and missing job codes entirely.
  - Workforce API model does not yet include job codes or the richer validation rules the legacy app relied on.
  - Planning routes/pages (`/planning`, `/demands`, `/staffing`) are still legacy-only and not yet reproduced in the TS backend.
  - Operational and admin pages mostly still point at legacy/static implementations or are absent in TS.

## Phased plan

### Phase 1 — Workforce parity (highest value first)
1. Extend TS workforce data model to include **job codes**.
2. Add TS API CRUD for **job codes**.
3. Expand TS workforce validation/serialization so employees expose richer metadata:
   - `job_code_name`
   - `role`
   - manager/direct report metadata
4. Upgrade TS page routes/UI for:
   - `/orgs` create/edit/delete
   - `/people` create/edit/delete
   - `/job-codes` create/edit/delete
5. Keep shared legacy-style chrome so these routes feel consistent while React coverage expands.

### Phase 2 — Planning parity
1. Add TS data model/store/services for:
   - projects/planning
   - demands
   - staffing/assignments
2. Recreate working TS-backed routes/pages for:
   - `/planning`
   - `/demands`
   - `/staffing`
3. Prioritize usable CRUD and list/detail workflows before chart polish.

### Phase 3 — Operational views
1. Re-home `/dashboard` on the TS backend with live TS data.
2. Add a stable TS-backed `/forecast` surface.
3. Keep `/canvas` stable; only fix blockers/regressions instead of chasing visual churn.

### Phase 4 — User/account/admin
1. Rebuild or re-host these onto TS routes with shared chrome:
   - `/inbox`
   - `/account-settings`
   - `/users`
   - `/audit`
   - `/runtime`
   - `/db-management`
2. Defer stylistic cleanup until core parity exists.

## Immediate implementation choice

Start with **Phase 1** and land a logical first chunk:
- add job code support to the TS backend
- finish workforce CRUD in the TS page layer
- ensure `/orgs`, `/people`, and `/job-codes` are all usable without touching the legacy frontend
