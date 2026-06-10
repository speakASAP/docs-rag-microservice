# Task Logging Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every task in the runlayer dashboard show full structured logs (requests, responses, status transitions, errors) per task — matching the agentic-email-processing-system pattern where each task/email has a scrollable log timeline.

**Architecture:** Fix a path bug in `LoggingClient` that silently drops all logs, then add `taskId` to the structured log calls already present in worker/coordinator services. The frontend already has `loadStepLogs`/`renderStepLogs` wired to the task execution view — we just need the logs to actually arrive there. No new logging infrastructure; the logging-microservice already supports `task_id` filtering.

**Tech Stack:** NestJS (TypeScript) · logging-microservice (file-based, port 3367) · Vanilla JS frontend · Socket.IO (already integrated)

---

## Root Cause Summary

The `LoggingClient` at `src/common/logging/logging.client.ts:30` posts to `/logs` but the logging-microservice controller is mounted at `@Controller('api/logs')`, making the real endpoint `/api/logs`. **Every log call from runlayer silently fails with a 404**. This is the primary bug — fixing it alone will surface all existing log calls in the UI.

Additionally, several log calls are missing `taskId` even when executing in task context (coding-worker, project-coordinator, some worker paths), meaning they won't appear when filtering by task in the UI.

---

## File Map

| File | Change |
|------|--------|
| `src/common/logging/logging.client.ts` | Fix `/logs` → `/api/logs` POST path |
| `src/common/logging/logging.client.ts` | Add `message` field alias so stored entries have `message` (not just `msg`) |
| `src/worker/worker-agent.service.ts` | Audit: verify all `logger.log()` calls include `taskId` ✅ (already good) |
| `src/coding-worker/coding-worker-agent.service.ts` | Add `taskId` to all `logger.log()` calls that are missing it |
| `src/coordinator/project-coordinator.service.ts` | Add `taskId` to log calls inside task dispatch/cycle loops |
| `src/dashboard/dashboard.controller.ts` | Normalize log response: map `msg` → `message`, add `metadata` passthrough |
| `public/app.js` | Add auto-refresh of step logs when WebSocket `task.updated` fires for the open task |

---

## Task 1: Fix LoggingClient POST path (root bug)

**Files:**
- Modify: `src/common/logging/logging.client.ts:30`

- [ ] **Step 1: Read the file to confirm the current path**

```bash
grep -n "post\|baseURL" /home/ssf/Documents/Github/runlayer/src/common/logging/logging.client.ts
```

Expected output:
```
23:    this.http = axios.create({ baseURL: ..., timeout: 3000 });
30:    await this.http.post('/logs', {
```

- [ ] **Step 2: Fix the POST path from `/logs` to `/api/logs`**

In `src/common/logging/logging.client.ts`, change line 30:

```typescript
// Before:
      await this.http.post('/logs', {
// After:
      await this.http.post('/api/logs', {
```

Also add `message` as an alias for `msg` so the stored entry has the standard field the UI uses:

```typescript
      await this.http.post('/api/logs', {
        service: 'runlayer',
        level: entry.level,
        message: entry.msg,  // standard field for logging service storage
        msg: entry.msg,      // keep for backwards compat
        correlation_id: entry.correlationId,
        business_id: entry.businessId,
        project_id: entry.projectId,
        task_id: entry.taskId,
        agent_id: entry.agentId,
        duration_ms: entry.durationMs ?? 0,
        timestamp: new Date().toISOString(),
        metadata: entry.metadata ?? {},
      });
```

- [ ] **Step 3: Smoke-test the fix against the live logging service**

```bash
curl -s -X POST http://localhost:3367/api/logs \
  -H 'Content-Type: application/json' \
  -d '{"service":"runlayer","level":"info","message":"test-log-path-fix","task_id":"test-123","timestamp":"2026-05-16T00:00:00.000Z","duration_ms":0}' | jq .
```

Expected: `{"success":true,"message":"Log ingested successfully"}`

Then query back:
```bash
curl -s "http://localhost:3367/api/logs/query?service=runlayer&task_id=test-123" | jq '.data | length'
```

Expected: `1`

- [ ] **Step 4: Build and deploy**

```bash
cd /home/ssf/Documents/Github/runlayer && ./scripts/deploy.sh
```

Wait for healthy. Then trigger a task cycle and check a task in the UI — Step Logs section should now show entries.

---

## Task 2: Add taskId to coding-worker log calls

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

The coding-worker has many `logger.log()` calls that omit `taskId`. Since the worker always has `task` and `taskId` in scope, they should all include it.

- [ ] **Step 1: Audit which log calls are missing taskId**

```bash
grep -n "logger.log" /home/ssf/Documents/Github/runlayer/src/coding-worker/coding-worker-agent.service.ts | grep -v "taskId"
```

- [ ] **Step 2: Add taskId to every missing log call**

Read the full file first, then for every `logger.log({` block that is missing `taskId,` — add it. The variable is always `taskId` or `task.id` (use `taskId` which equals `task.id`).

Pattern to apply everywhere:
```typescript
// Before (example):
await this.logger.log({
  level: 'info',
  msg: 'coding_plan_step_start',
  projectId: task.projectId,
  durationMs: 0,
  metadata: { step: step.file, action: step.action },
});
// After:
await this.logger.log({
  level: 'info',
  msg: 'coding_plan_step_start',
  taskId,           // ← add this
  projectId: task.projectId,
  durationMs: 0,
  metadata: { step: step.file, action: step.action },
});
```

- [ ] **Step 3: Build and check no TypeScript errors**

```bash
cd /home/ssf/Documents/Github/runlayer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (no errors).

- [ ] **Step 4: Deploy**

```bash
./scripts/deploy.sh
```

---

## Task 3: Add taskId to project-coordinator log calls inside task dispatch

**Files:**
- Modify: `src/coordinator/project-coordinator.service.ts`

The project-coordinator runs cycles and dispatches tasks. When it logs events related to a specific task (dispatch, failure, etc.), those logs should include `taskId` so they appear in the task log view.

- [ ] **Step 1: Find log calls in coordinator that have a task in context**

```bash
grep -n "logger.log\|task\.id\|taskId" /home/ssf/Documents/Github/runlayer/src/coordinator/project-coordinator.service.ts | head -40
```

- [ ] **Step 2: Add taskId where a task is in scope**

Read `src/coordinator/project-coordinator.service.ts` fully. For any `logger.log({` block that executes while iterating over or processing a specific task, add `taskId: task.id` (the task variable name may be `task`, `t`, or similar — match what's in scope):

```typescript
// Example: dispatching a task to a worker
await this.logger.log({
  level: 'info',
  msg: 'task_dispatched_to_worker',
  taskId: task.id,          // ← add where task is in scope
  projectId: task.projectId,
  durationMs: 0,
  metadata: { worker_id: workerId, task_type: task.type },
});
```

Do NOT add `taskId` to cycle-level logs (no specific task in scope, e.g. `cycle_started`, `cycle_skipped_quota`) — those are project-level and taskId would be wrong.

- [ ] **Step 3: Build check**

```bash
cd /home/ssf/Documents/Github/runlayer && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Deploy**

```bash
./scripts/deploy.sh
```

---

## Task 4: Normalize dashboard log response for UI compatibility

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts:140-157`

The `GET /api/dashboard/tasks/:taskId/logs` endpoint currently returns raw log entries from the logging service. The logging service stores `message` (because `logs.service.ts:101` resolves `message || msg`), so the stored entry has `message`. But we want to guarantee the UI always gets `message` even for edge cases.

Also: the response from the query endpoint is `{ data: [...] }` — the dashboard controller already maps this correctly with `resp.data?.data ?? []` but we should also verify the response shape matches the frontend's `renderStepLogs` expectations.

- [ ] **Step 1: Read the current taskLogs handler**

```typescript
// src/dashboard/dashboard.controller.ts lines 140-157
@Get('tasks/:taskId/logs')
@UseGuards(JwtGuard)
async taskLogs(
  @Param('taskId') taskId: string,
  @Query('limit') limit?: string,
) {
  const loggingUrl = this.configService.get<string>('loggingService.url') ?? 'http://logging-microservice:3367';
  const lim = Math.min(Number(limit ?? '200'), 500);
  try {
    const resp = await axios.get(
      `${loggingUrl}/api/logs/query?task_id=${encodeURIComponent(taskId)}&service=runlayer&limit=${lim}`,
      { timeout: 5000 },
    );
    return { logs: resp.data?.data ?? [] };
  } catch {
    return { logs: [], error: 'logging service unavailable' };
  }
}
```

- [ ] **Step 2: Add normalization to guarantee `message` field and clean `metadata`**

Replace the `taskLogs` handler body with:

```typescript
@Get('tasks/:taskId/logs')
@UseGuards(JwtGuard)
async taskLogs(
  @Param('taskId') taskId: string,
  @Query('limit') limit?: string,
) {
  const loggingUrl = this.configService.get<string>('loggingService.url') ?? 'http://logging-microservice:3367';
  const lim = Math.min(Number(limit ?? '200'), 500);
  try {
    const resp = await axios.get(
      `${loggingUrl}/api/logs/query?task_id=${encodeURIComponent(taskId)}&service=runlayer&limit=${lim}`,
      { timeout: 5000 },
    );
    const raw: any[] = resp.data?.data ?? [];
    const logs = raw.map((entry) => ({
      level: entry.level || 'info',
      message: entry.message || entry.msg || '(no message)',
      timestamp: entry.timestamp,
      metadata: entry.metadata ?? {},
    }));
    return { logs };
  } catch {
    return { logs: [], error: 'logging service unavailable' };
  }
}
```

- [ ] **Step 3: Build check**

```bash
cd /home/ssf/Documents/Github/runlayer && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Deploy**

```bash
./scripts/deploy.sh
```

---

## Task 5: Auto-refresh step logs in UI when task updates via WebSocket

**Files:**
- Modify: `public/app.js`

Currently the Step Logs panel is static — it loads once when you open the task execution view. If a task is in progress, new logs won't appear without manual refresh. The WebSocket already fires `task.updated` events. We should auto-refresh step logs when the open task gets an update.

- [ ] **Step 1: Find where WebSocket task.updated is handled in app.js**

```bash
grep -n "task.updated\|socket.*on\|liveSocket" /home/ssf/Documents/Github/runlayer/public/app.js | head -20
```

- [ ] **Step 2: Read the WebSocket task.updated handler**

Find the block that handles `socket.on('task.updated', ...)` and read ~20 lines around it.

- [ ] **Step 3: Add auto-refresh of step logs when the open task updates**

In the `task.updated` handler, after updating the task row in the table, add:

```javascript
// If the execution log view is open for this task, auto-refresh step logs
const execView = document.getElementById('execution-log-view');
if (execView && execView.style.display !== 'none') {
  // Check if the current URL matches this task
  const currentHash = window.location.hash;
  const openTaskId = currentHash.match(/\/#\/tasks\/([^/]+)$/)?.[1];
  if (openTaskId && decodeURIComponent(openTaskId) === payload.taskId) {
    refreshStepLogs(payload.taskId);
  }
}
```

- [ ] **Step 4: Verify the UI renders correctly**

Trigger a coordinator cycle:
```bash
curl -s -X POST http://localhost:3390/api/coordinator/trigger -H 'Content-Type: application/json' | jq .
```

Open the dashboard, navigate to a task's execution log view, and verify:
1. Step Logs section shows entries (not "No step logs recorded for this task yet.")
2. When the task is active, new log entries appear automatically (within ~30s)
3. The Refresh button also works

---

## Task 6: Add in-task request/response logs to worker (mirror reference app pattern)

**Files:**
- Modify: `src/worker/worker-agent.service.ts`

The reference app (`agentic-email-processing-system`) logs detailed request/response data at each stage. The worker already logs `worker_ai_call_start` and `worker_ai_call_success` with `prompt` and `full_response` in metadata. But we want to add stage-boundary logs that are more readable in the timeline — mirroring the reference app's `Stage started: X` / `Stage completed: X` pattern.

- [ ] **Step 1: Add stage-boundary log calls to `_executeInner`**

In `src/worker/worker-agent.service.ts`, inside `_executeInner`, add these log calls at the stage boundaries:

After `await this.tasksService.markInProgress(taskId)` (already called in `execute`), at the start of `_executeInner`:
```typescript
await this.logger.log({
  level: 'info',
  msg: 'task_stage_start',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: { stage: 'worker_execute', task_type: task.type, attempt: task.attempt },
});
```

After the router check, before AI call:
```typescript
await this.logger.log({
  level: 'info',
  msg: 'task_stage_start',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: { stage: 'ai_call', model_tier: modelTier, task_type: task.type },
});
```

After successful AI response:
```typescript
await this.logger.log({
  level: 'info',
  msg: 'task_stage_complete',
  taskId,
  projectId: project.id,
  durationMs: Date.now() - aiCallStart,
  metadata: {
    stage: 'ai_call',
    model_used: aiResponse?.model_used ?? modelTier,
    output_keys: Object.keys(aiResponse?.output_ref ?? {}),
    tokens: aiResponse?.token_usage_estimate ?? 0,
  },
});
```

After validation completes (pass or fail):
```typescript
await this.logger.log({
  level: validationOutcome.validation_passed ? 'info' : 'warn',
  msg: 'task_stage_complete',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: {
    stage: 'validation',
    passed: validationOutcome.validation_passed,
    verdict: validationOutcome.verdict,
    reason: validationOutcome.reason,
  },
});
```

- [ ] **Step 2: Build check**

```bash
cd /home/ssf/Documents/Github/runlayer && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Deploy**

```bash
./scripts/deploy.sh
```

- [ ] **Step 4: End-to-end verify**

Trigger a cycle and open a task that runs. Confirm the Step Logs timeline shows:
- `task_stage_start` (worker_execute)
- `worker_budget_check`
- `worker_model_tier`
- `task_stage_start` (ai_call)
- `worker_ai_call_start` (with full prompt in metadata)
- `worker_ai_call_success` (with full response in metadata)
- `task_stage_complete` (ai_call)
- `worker_validation_start`
- `worker_validation_end`
- `task_stage_complete` (validation)
- `worker_task_done` or failure logs

---

## Self-Review Checklist

- [x] **Root bug fixed**: `LoggingClient` path `/logs` → `/api/logs` (Task 1)
- [x] **Message field**: `message` alias added alongside `msg` in POST body (Task 1)
- [x] **taskId propagation**: coding-worker and coordinator log calls get `taskId` (Tasks 2, 3)
- [x] **Response normalization**: dashboard controller normalizes `message` field (Task 4)
- [x] **Live refresh**: WebSocket auto-refreshes step logs when task updates (Task 5)
- [x] **Rich stage logs**: worker logs stage-boundary events readable in timeline (Task 6)
- [x] **No new dependencies**: uses existing logging-microservice, LoggingClient, and frontend functions
- [x] **No breaking changes**: all changes are additive or bug fixes
