# Portfolio Contracts Freeze (PF-1)

## Status

Frozen for PF-2/PF-3 implementation.

## Dashboard response contract

`GET /api/dashboard`

Top-level:

- `businesses[]`
- `agents`

Business object:

- `id`
- `slug`
- `name`
- `status`
- `ownerId`
- `settingsRef`
- `quota`
- `createdAt`
- `projects[]`

Project summary object:

- `projectId` (canonical card ID)
- `id` (alias, same value)
- `slug`
- `name`
- `status`
- `stage`
- `health`
- `tasksActive`
- `lastCycleAt`
- `nextFocus`
- `activeGoal`

Active goal object (nullable):

- `id`
- `title`
- `completionPct`
- `status`
- `blockedReason`

## Lifecycle API semantics

Business:

- Create: `POST /api/businesses`
- Read list: `GET /api/businesses`
- Read single: `GET /api/businesses/:id`
- Onboard: `POST /api/businesses/onboard`
- Update: `PATCH /api/businesses/:id`
- Soft offboard: `POST /api/businesses/:id/offboard`
- Hard unregister: `POST /api/businesses/:id/unregister`

Project:

- Create: `POST /api/businesses/:businessId/projects`
- Read list: `GET /api/businesses/:businessId/projects`
- Read single: `GET /api/businesses/:businessId/projects/:projectId`
- Update: `PATCH /api/businesses/:businessId/projects/:projectId`
- Soft offboard: `POST /api/businesses/:businessId/projects/:projectId/offboard`
- Hard unregister: `POST /api/businesses/:businessId/projects/:projectId/unregister`

### CRUD/offboard mapping

Business:

- Create: `POST /api/businesses`
- Read: `GET /api/businesses`, `GET /api/businesses/:id`
- Update: `PATCH /api/businesses/:id`
- Delete semantics: no physical delete endpoint is part of this freeze; destructive removal is represented only by hard unregister and is limited to orchestrator-managed records.
- Soft offboard: logical deactivation from active operations while records remain available for management/history.
- Hard unregister: orchestrator-domain unlink/removal only, bounded by safety rules below.

Project:

- Create: `POST /api/businesses/:businessId/projects`
- Read: `GET /api/businesses/:businessId/projects`, `GET /api/businesses/:businessId/projects/:projectId`
- Update: `PATCH /api/businesses/:businessId/projects/:projectId`
- Delete semantics: no physical delete endpoint is part of this freeze; destructive removal is represented only by hard unregister and is limited to orchestrator-managed records.
- Soft offboard: logical deactivation from active operations while project records remain available for management/history.
- Hard unregister: orchestrator-domain unlink/removal only, bounded by safety rules below.

## Safety boundary for hard unregister

Hard unregister is strictly domain-local to `business-orchestrator` persistence.

Hard unregister MUST NOT:

- delete GitHub repositories
- delete local folders
- stop or delete external project runtimes

Hard unregister only removes orchestrator-managed records and links.

## PF-2 and PF-3 contract dependencies

PF-2 (Business/Project lifecycle API implementation) depends on:

- Preserved `business -> projects[]` dashboard nesting.
- Required project card fields in dashboard payload: `projectId`, `health`, `activeGoal`, `tasksActive`.
- Endpoint set and semantics defined in Lifecycle API + CRUD/offboard mapping sections.
- Safety boundary enforcement for hard unregister (orchestrator-only and non-destructive externally).

PF-3 (Portfolio UI/dashboard consumption) depends on:

- Stable dashboard response shape at `GET /api/dashboard` with `businesses[]` and per-business `projects[]`.
- Project summary fields including aliases (`projectId`, `id`) and card-critical fields (`health`, `activeGoal`, `tasksActive`).
- Active goal object nullability and shape (`id`, `title`, `completionPct`, `status`, `blockedReason`).
- Non-breaking semantics: soft offboard retains records for UI state/visibility; hard unregister removes orchestrator records only.

Compatibility guarantee for PF-2/PF-3:

- PF-1 frozen contract is authoritative for shape and semantics in this phase.
- Any contract change after freeze must be treated as breaking unless PF-2 and PF-3 are updated in lockstep.
