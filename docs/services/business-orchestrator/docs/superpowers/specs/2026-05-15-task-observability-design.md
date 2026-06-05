# Task Observability Design
**Date:** 2026-05-15  
**Status:** draft — awaiting user approval

## Problem

Tasks in Project OS (`business-orchestrator`) are created and immediately stuck as `created` with no indication of why. The user sees a list of tasks with status badges but no answer to: *Why hasn't this started? What did the AI do? What failed?*

Root cause of current incident: all 5 worker agents are `disabled`, only 2 `validator`-type agents are idle. `findIdleWorkers` returns 0 → every dispatch tick silently exits. The only log is a bare `[WP] dispatch called` with no payload.

## Goal

The user should be able to open any task in the dashboard and see:
1. **Why it hasn't started** — agent pool health, quota block, cycle skip reason
2. **Every AI call made for that task** — full prompt + response stored in logs, key fields (model, tokens, outcome) shown in UI
3. **Each step that failed** — with the exact error, log line, and timestamp

Modeled on `agentic-email-processing-system`: per-item step log buffer → "See logs" panel in dashboard.

---

## Architecture

### Option C — Central logging-microservice with `task_id` filter

All structured log entries from business-orchestrator already go to `logging-microservice` via `LoggingClient`. We extend this pattern:

1. **logging-microservice** gains a `task_id` query parameter on `GET /api/logs/query`
2. **business-orchestrator** tags every meaningful log entry with `metadata.task_id`
3. **Dashboard** adds a "Step Logs" panel per task that calls the logging-microservice query endpoint via the orchestrator proxy

AI prompts and responses are stored **in full** in the log metadata (no size limit on the logging side). The orchestrator context carries only `model_used`, `tokens`, `outcome`.

---

## Component Changes

### 1. logging-microservice — `task_id` query filter

**File:** `src/logs/logs.controller.ts`  
Add `task_id?: string` query param to `GET /api/logs/query`.

**File:** `src/logs/logs.service.ts`  
Extend `query()` filters: when `task_id` is set, filter log lines where `metadata.task_id === task_id` (or `logEntry.task_id === task_id` if the orchestrator sends it at root level).

The current query implementation reads all log files linearly. With `task_id` filter this works because task logs are a small fraction of total volume. No DB migration needed.

**File:** `src/logs/dto/log-entry.dto.ts`  
Add optional `task_id?: string` field at root level (alongside `service`, `level`, `message`) so the query can filter by a top-level indexed field rather than walking nested metadata.

### 2. business-orchestrator — `LoggingClient` tagging

**File:** `src/common/logging/logging.client.ts`  
The `LogEntry` interface already has `taskId?: string`. It is serialized as `task_id` in the POST body. Confirm the log body sends `task_id` at root level (not only inside `metadata`) so the logging service can filter efficiently.

No change needed if already at root — just verify.

### 3. business-orchestrator — `WorkerPoolService` dispatch logging

**File:** `src/worker/worker-pool.service.ts`  
Replace the bare `console.log('[WP] dispatch called')` with a structured log every tick:

```
{
  level: 'info' | 'warn',
  msg: 'worker_pool_tick',
  metadata: {
    idle_workers: number,           // how many type=worker status=idle
    disabled_workers: number,       // how many type=worker status=disabled  
    busy_workers: number,
    pending_tasks: number,
    dispatched: number,
    skip_reason: string | null      // 'no_idle_workers' | 'no_pending_tasks' | null
  }
}
```

Level is `warn` when `skip_reason === 'no_idle_workers'` so it surfaces in the UI without requiring a filter.

### 4. business-orchestrator — `WorkerAgentService` step logging

**File:** `src/worker/worker-agent.service.ts`  
Add `task_id`-tagged log entries at each step, all with `level: 'info'` unless failure:

| Step | msg key | Key metadata |
|------|---------|--------------|
| Budget check | `worker_budget_check` | `allowed`, `used`, `quota` |
| AI call start | `worker_ai_call_start` | `model_tier`, `attempt`, `prompt` (full) |
| AI call success | `worker_ai_call_success` | `model_used`, `tokens`, `output_ref` (full) |
| AI call error | `worker_ai_timeout` | already exists — add `prompt_full` |
| Wrong schema | `worker_wrong_schema` | already exists — add `prompt_full`, `response_full` |
| Validation start | `worker_validation_start` | `acceptance_criteria` |
| Validation end | `worker_validation_end` | `passed`, `reason`, `verdict` |
| Task done | `worker_task_done` | `output_ref` (full) |
| Requeue | `worker_task_requeued` | `reason`, `attempt`, `max_attempts` |
| Terminal fail | `worker_task_failed_terminal` | already `task_failed_terminal` — ensure `task_id` at root |

The full AI prompt and full AI response are stored only in `metadata` (written to log files, not kept in TypeScript memory beyond the log call). TypeScript variables keep only `model_used`, `tokens`, `outcome`.

### 5. business-orchestrator — `ProjectCoordinatorService` step logging

**File:** `src/coordinator/project-coordinator.service.ts`  
Add `task_id`-tagged entries at coordinator cycle steps. Since coordinator cycles are per-project (not per-task), tag them with `metadata.project_id` rather than a task_id. The logging-microservice query also gains a `project_id` filter (same pattern as `task_id`). The dashboard project view can query coordinator logs separately.

| Step | msg key | Key metadata |
|------|---------|--------------|
| Cycle start | `coordinator_cycle_start` | `project_id`, `goal_title`, `available_workers` |
| AI call start | `coordinator_ai_call_start` | `prompt` (full) |
| AI call success | `coordinator_ai_call_success` | `model_used`, `tasks_proposed` (array of types) |
| Quota skip | `cycle_skipped_quota` | already exists |
| No goal skip | `cycle_skipped_no_active_goal` | already exists |
| Spec missing | `cycle_skipped_spec` | already exists |
| Task created | `coordinator_task_created` | `task_id`, `type`, `priority` |
| Cycle complete | `coordinator_cycle_complete` | `tasks_created`, `duration_ms` |

### 6. business-orchestrator — proxy endpoint

**File:** `src/dashboard/dashboard.controller.ts`  
Add:

```
GET /api/dashboard/tasks/:taskId/logs?limit=100
```

This proxies to `logging-microservice/api/logs/query?task_id=<taskId>&service=business-orchestrator&limit=100`. Returns the array of log entries directly. Auth: `JwtGuard` (same as existing dashboard endpoints).

Rationale: the browser can't call logging-microservice directly (different port, no CORS). The orchestrator acts as an authenticated proxy.

### 7. business-orchestrator — agent health endpoint

**File:** `src/dashboard/dashboard.controller.ts`  
Add:

```
GET /api/dashboard/agent-health
```

Returns:

```json
{
  "workers": { "idle": 0, "busy": 0, "disabled": 5, "total": 5 },
  "validators": { "idle": 2, "busy": 0, "disabled": 0, "total": 2 },
  "allWorkersDisabled": true
}
```

### 8. business-orchestrator — enable-workers admin endpoint

**File:** `src/dashboard/dashboard.controller.ts`  
Add:

```
POST /api/admin/agents/enable-workers
```

Sets all `status='disabled'` workers to `status='idle'`. Requires `JwtGuard`. Returns count of agents re-enabled.

This is the immediate unblock for the current incident and any future recurrence.

### 9. Dashboard frontend — agent health banner

**File:** `public/app.js`  
On dashboard load, call `GET /api/dashboard/agent-health`. If `allWorkersDisabled === true`, show a red sticky banner:

```
⚠ All worker agents are disabled — tasks will not start. [Enable workers]
```

`[Enable workers]` calls `POST /api/admin/agents/enable-workers` and refreshes.

If `workers.idle === 0` and `workers.busy === 0` (but not all disabled), show a yellow banner:

```
⚠ No idle workers available — tasks are queued.
```

### 10. Dashboard frontend — task step logs panel

**File:** `public/app.js`  
Extend `openExecutionLog(taskId, type)` (currently shows sparse execution rows):

After the existing execution list, add a **"Step Logs"** section. On click of a task row:
1. Fetch `GET /api/dashboard/tasks/:taskId/logs?limit=100`
2. Render as a vertical timeline — same visual style as agentic-email's "See logs" modal:
   - Level badge (`INFO` / `WARN` / `ERROR`)
   - Timestamp
   - `msg` as title
   - Collapsible metadata block (click to expand full prompt/response)
3. Auto-scroll to first `error` entry if any
4. Show "No step logs yet" if empty (task hasn't been picked up)

### 11. Dashboard frontend — task table blocked_reason inline

**File:** `public/app.js`  
In `openGoalDetail`, the task row already has `status` badge. Extend:
- If `status === 'created'` and `attempt > 0`, append `blocked_reason` as a small gray subtitle under the type cell
- If `status === 'failed'`, show `blocked_reason` in red

---

## Data Flow

```
WorkerPoolService.dispatch()
  → logger.log({ msg: 'worker_pool_tick', metadata: { idle_workers, disabled_workers, ... } })
      → LoggingClient.log()  (fire-and-forget, 3s timeout)
          → POST logging-microservice/api/logs  (stores to business-orchestrator.log)

WorkerAgentService.execute(taskId)
  → logger.log({ msg: 'worker_ai_call_start', taskId, metadata: { prompt: FULL_PROMPT } })
  → AI call
  → logger.log({ msg: 'worker_ai_call_success', taskId, metadata: { model_used, tokens, output_ref: FULL } })

Dashboard browser
  → GET /api/dashboard/tasks/:taskId/logs
      → DashboardController proxies to logging-microservice/api/logs/query?task_id=:taskId
          → LogsService reads business-orchestrator.log, filters metadata.task_id === taskId
              → returns array of {level, message, timestamp, metadata}
```

---

## What is NOT changed

- `Execution` entity — no new columns, no migration
- RabbitMQ events — no change
- Logging-microservice storage format — still file-based JSON, no DB needed
- Auth flow — reuse existing `JwtGuard`

---

## Immediate fix (separate from logging feature)

Before or alongside this work: re-enable worker agents.

```sql
UPDATE business_orchestrator.agents SET status = 'idle' WHERE type = 'worker' AND status = 'disabled';
```

Or via the new `POST /api/admin/agents/enable-workers` endpoint once built. The dashboard `[Enable workers]` button is the user-facing version.

---

## Success criteria

- User opens a stuck task → sees "Step Logs" panel with timestamped entries explaining why it didn't start (e.g. `worker_pool_tick: skip_reason=no_idle_workers, disabled_workers=5`)
- User opens a failed task → sees exact AI prompt sent, AI response received, validation verdict
- Red banner appears on dashboard when all workers are disabled, with one-click fix
- All AI prompt/response text is in log files, not in TypeScript heap

---

## Files changed summary

| Service | File | Change |
|---------|------|--------|
| logging-microservice | `src/logs/logs.controller.ts` | Add `task_id` query param |
| logging-microservice | `src/logs/logs.service.ts` | Filter by `task_id` in `query()` |
| logging-microservice | `src/logs/dto/log-entry.dto.ts` | Add optional `task_id` root field |
| business-orchestrator | `src/common/logging/logging.client.ts` | Ensure `task_id` sent at root level |
| business-orchestrator | `src/worker/worker-pool.service.ts` | Replace console.log with structured logger |
| business-orchestrator | `src/worker/worker-agent.service.ts` | Add step log entries with full prompt/response in metadata |
| business-orchestrator | `src/coordinator/project-coordinator.service.ts` | Add cycle step log entries with full prompt |
| business-orchestrator | `src/dashboard/dashboard.controller.ts` | Add 3 endpoints: `/tasks/:id/logs`, `/agent-health`, `/admin/agents/enable-workers` |
| business-orchestrator | `public/app.js` | Agent health banner + task step logs panel + blocked_reason inline |
