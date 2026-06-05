# Spec: Pending Approval as System Default

**Date:** 2026-05-27  
**Status:** Approved

## Problem

Every project's `executionMode` defaults to `'auto'`, meaning tasks created by the coordinator are dispatched immediately to workers without any human review. The user requires full control over every execution step: no task should start automatically under any circumstances.

## Goal

Make `pending_approval` the universal default state for every newly created or re-queued task across all projects. The user must explicitly approve a task (via the dashboard button or API) before it can be picked up by a worker.

## Scope

Two changes, applied together:

### Change 1 — Flip the default executionMode to `'manual'`

- `Project.executionMode` column default: `'auto'` → `'manual'`
- SQL migration flips all existing rows: `UPDATE projects SET execution_mode = 'manual' WHERE execution_mode = 'auto'`
- The existing `resolveCreatedStatus()` in `TasksService` already returns `'pending_approval'` for manual projects — no logic change needed there
- All task creation paths (`create`, `requeueAfterFailure`, `resetOrFail`, `forceRequeue`) already call `resolveCreatedStatus()`, so they all inherit the correct initial status automatically

### Change 2 — Remove `interceptPendingForManualMode`

- Delete the `interceptPendingForManualMode()` method from `WorkerPoolService` and its call site in `dispatch()`
- Rationale: with the default now `'manual'`, a `created` task should never reach the pool for manual projects. The sweep was a second-chance safety net that is now dead code. Removing it eliminates a confusing code path and the extra per-tick DB query.
- The `findPending()` query already filters out `pending_approval` tasks (`status = 'created'`), so the worker pool remains safe even without the sweep.

## What does NOT change

- The `executionMode` field and `setExecutionMode` endpoint remain. `'auto'` mode still exists and can be re-enabled per-project by a human operator if ever needed.
- The `approveTask` / `rejectTask` / `findPendingApproval` service methods and dashboard API endpoints are unchanged.
- The dashboard WebSocket event `task.pending_approval` is unchanged.
- No change to task entity fields or status state machine.

## Migration

New file: `migrations/010_default_execution_mode_manual.sql`

```sql
BEGIN;
SET lock_timeout = '3s';
-- Flip all existing auto projects to manual
UPDATE business_orchestrator.projects
  SET execution_mode = 'manual'
  WHERE execution_mode = 'auto';
-- Change the column default so new projects are manual by default
ALTER TABLE business_orchestrator.projects
  ALTER COLUMN execution_mode SET DEFAULT 'manual';
COMMIT;
```

## Test impact

- `ProjectsService.create()` test: the new project's `executionMode` should be `'manual'`
- `WorkerPoolService`: remove tests that exercise `interceptPendingForManualMode`
- Existing `approveTask` / `rejectTask` / `markPendingApproval` tests are unaffected

## Risk

Low. All logic paths already handle `manual` mode correctly. The migration is a single `UPDATE` with no structural schema change. The removed function was purely additive (it could only move tasks from `created` → `pending_approval`, never the reverse).
