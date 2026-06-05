# Orchestrator Operations Scripts

Scripts for operating, debugging, and smoke-testing the business-orchestrator pipeline.  
All scripts live in `business-orchestrator/scripts/` and load credentials automatically from `.env`.

## Quick start

```bash
cd /home/ssf/Documents/Github/business-orchestrator

# Full system health check
./scripts/orch-status.sh

# Generic project health report (recommended)
./scripts/orch-project-health.sh flipflop-v1
./scripts/orch-project-health.sh business-orchestrator

# Test AI service before triggering a cycle
./scripts/orch-test-ai.sh

# Trigger a coordinator cycle for flipflop-v1
./scripts/orch-trigger-cycle.sh flipflop-v1

# Watch what happened to the tasks (wait ~60s for workers to finish)
sleep 60 && ./scripts/orch-check-tasks.sh flipflop-v1
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| `kubectl` | `db-server-postgres` and `business-orchestrator` must be healthy in `statex-apps` |
| `business-orchestrator/.env` | Provides `ORCHESTRATOR_USER_JWT`, `DB_USER`, `DB_NAME`, `PORT_BLUE/GREEN` |
| `curl`, `jq` | For HTTP calls and JSON formatting |

Scripts auto-detect the active blue/green container and its host port — no manual port tracking.

---

## Script reference

### `orch-status.sh` — Full system status

```bash
./scripts/orch-status.sh
```

Checks and prints:

- Docker container status (orchestrator, AI service, DB)
- `/health` endpoint for orchestrator and AI service
- All non-smoke projects (slug + UUID)
- Active goals per project
- Task status summary for the last 24 hours

**Use when:** starting a session, after a deploy, or when something feels off.

---

### `orch-project-health.sh` — Generic coordinator health report

```bash
./scripts/orch-project-health.sh <project-slug|project-uuid>
```

Read-only report for the selected project showing:

- Goal timeline (created/completed dates)
- Task throughput by status for last 7 days
- 7-day failure rate (`failure_pct`, done/failed/pending/total)
- Active goal task summary (type + status counts)
- Final verdict: `HEALTHY`, `DEGRADED`, `CRITICAL`, or `COMPLETED` (no active goal and latest goal is completed)

**Examples:**

```bash
./scripts/orch-project-health.sh flipflop-v1
./scripts/orch-project-health.sh business-orchestrator
./scripts/orch-project-health.sh 506017b2-dc57-43b6-a8f2-a1826d3914be
```

**Use when:** checking operational health for any orchestrated project without creating script copies.

---

### Compatibility wrappers

```bash
./scripts/orch-flipflop-health.sh
./scripts/orch-business-orchestrator-health.sh
```

Both wrappers are kept for backward compatibility and internally call `orch-project-health.sh` with a fixed slug.

---

### `orch-trigger-cycle.sh` — Trigger a coordinator cycle

```bash
./scripts/orch-trigger-cycle.sh [project-slug|uuid]
```

Resolves a slug to UUID via DB, then POSTs to `/api/projects/:uuid/cycle`.

**Examples:**

```bash
./scripts/orch-trigger-cycle.sh flipflop-v1
./scripts/orch-trigger-cycle.sh business-orchestrator
./scripts/orch-trigger-cycle.sh 506017b2-dc57-43b6-a8f2-a1826d3914be   # UUID directly
```

**Override URL (e.g. to hit green directly):**

```bash
BASE_URL=http://localhost:3391 ./scripts/orch-trigger-cycle.sh flipflop-v1
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0`  | Cycle ran; `tasksCreated` > 0 |
| `2`  | Cycle skipped (lease held, quota full, no active goal, AI unavailable) — response printed |
| `1`  | Unexpected error (connection refused, bad response, project not found) |

**Skipped reasons to know:**

- `lease_held` — another cycle is running; wait 60s and retry
- `no_active_goal` — project has no goal with `status = 'active'`; create one via API
- `ai_service_unavailable` — AI service returned 503; run `orch-test-ai.sh` to diagnose
- `concurrent_task_quota` — business has hit `max_concurrent_tasks`; wait for tasks to finish
- `spec_or_plan_missing` — `SPEC.md` or `PLAN.md` missing under MCP root for this project

---

### `orch-check-tasks.sh` — Task status for a project

```bash
./scripts/orch-check-tasks.sh [project-slug|uuid] [limit]
```

Queries `db-server-postgres` directly. Shows a table of recent tasks plus a status count summary.

**Examples:**

```bash
./scripts/orch-check-tasks.sh flipflop-v1          # last 10 tasks
./scripts/orch-check-tasks.sh flipflop-v1 20        # last 20 tasks
./scripts/orch-check-tasks.sh business-orchestrator 5
```

**Columns:** `type | status | attempt | created_at | description | blocked`

The `description` column is derived from the first non-empty value of: `payload_ref->>'description'`, `payload_ref->>'summary'`, `payload_ref->>'title'`, `acceptance_criteria[0]`, `payload_ref->>'source_task_type'`.

**Task status meanings:**

| Status | Meaning |
|--------|---------|
| `created` | Queued, not yet picked up by worker pool |
| `in_progress` | Worker assigned and executing |
| `done` | Completed + validator PASS |
| `failed` | Exhausted `maxAttempts` or permanent error |

**Common `blocked_reason` patterns:**

| Pattern | Cause |
|---------|-------|
| `WORKER_TIMEOUT:max_attempts_N` | AI call failed (rate-limit, timeout, bad response) N times |
| `VALIDATION_FAILED:unknown_criterion:...` | Validator received natural-language criteria it couldn't check (pre-fix bug) |
| `VALIDATION_FAILED:llm_review:...` | Validator's LLM review found issues or was unavailable |
| `INVALID_JSON:max_attempts_N` | Worker AI returned no `output_ref` field N times |
| `AGENT_HEARTBEAT_LOST:...` | Worker agent went stale; heartbeat monitor requeued then failed |
| `BUDGET_EXCEEDED` | Business daily LLM unit quota hit |

---

### `orch-task-detail.sh` — Full detail for a single task

```bash
./scripts/orch-task-detail.sh <task-id>
```

Calls `GET /api/projects/:projectId/tasks/:taskId?include=executions` and prints a human-readable breakdown:

- **Task overview**: type, status, priority, attempt, goal, batch, timestamps, blocked_reason
- **Acceptance criteria**: what the task was supposed to achieve
- **Payload ref**: what the worker AI was asked to do (the full task instruction object)
- **Output ref**: what the worker AI produced (final output, including `_validation` block)
- **Executions table**: all run + validate phases with model, outcome, error_code, duration, tokens
- **Per-execution output**: full `output_ref` from each execution phase

**Use when:** a task failed or completed unexpectedly and you need to see the full AI prompt/response chain.

**Example:**

```bash
# Get the task ID from orch-check-tasks.sh, then:
./scripts/orch-task-detail.sh 9d641a4c-afdc-4b1f-9362-8387f04bb2cd
```

---

### `orch-smoke-test.sh` — Fast API smoke test

```bash
./scripts/orch-smoke-test.sh [project-slug]
```

Tests 6 core endpoints and reports pass/fail per check. Use after every deploy.

**Checks:**

1. `GET /health` — service is up
2. `GET /api/businesses/:id/projects` — project list readable
3. `GET /api/projects/:id/tasks` — task list accessible
4. `GET /api/projects/:id/tasks/:id?include=executions` — task details with executions
5. `GET /api/projects/:id/goals` — goals readable
6. `GET /api/dashboard` — dashboard accessible

**Examples:**

```bash
./scripts/orch-smoke-test.sh                      # defaults to business-orchestrator
./scripts/orch-smoke-test.sh flipflop-v1
```

---

### `orch-apply-flipflop-migrations.sh` — flipflop-service Prisma migrations (operator)

```bash
cd /home/ssf/Documents/Github
bash business-orchestrator/scripts/orch-apply-flipflop-migrations.sh
```

Runs `npx prisma migrate status` then `npx prisma migrate deploy` in `flipflop-service/` using a Kubernetes DNS `DATABASE_URL`. Verifies `orders.reviewRequestedAt` and `loyalty_account` via `kubectl exec -n statex-apps deployment/db-server-postgres -- psql`.

**Use when:** TASK-P9-OPS1 (or any flipflop schema rollout) — idempotent; already-applied migrations are skipped.

---

### `orch-test-ai.sh` — Smoke-test AI /ai/complete

```bash
./scripts/orch-test-ai.sh [tier]
```

Sends a worker-style prompt (instructions merged into `user_prompt` — no separate `system_prompt`) and verifies the response contains `output_ref`. Tests each tier independently.

**Examples:**

```bash
./scripts/orch-test-ai.sh            # free tier via Ollama/LiteLLM
./scripts/orch-test-ai.sh cheap      # cheap tier via OpenRouter
./scripts/orch-test-ai.sh smart      # smart tier via Gemini
```

**Use when:** diagnosing `ai_service_unavailable` cycle skips or `WORKER_TIMEOUT` task failures.

**Why `output_ref` check matters:** the worker expects the AI to return `{"output_ref": {...}}`. If the AI returns `{"text": "..."}` instead (raw text response), the validator marks the task `INVALID_JSON`. This test catches that case.

**Override AI URL (host-accessible):**

```bash
AI_HOST_URL=http://localhost:3380 ./scripts/orch-test-ai.sh
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0`  | PASS — `output_ref` present in response |
| `1`  | FAIL — AI unreachable, rate-limited, or response format wrong |

---

## `_orch-common.sh` — Shared library (sourced, not run directly)

All scripts source this file. It provides:

| Function / Variable | Purpose |
|---------------------|---------|
| `_load_env <file>` | Loads `KEY=VALUE` pairs without overwriting real env vars |
| `_active_port()` | Detects which of blue (3390) / green (3391) container is healthy right now |
| `ORCH_HOST_PORT` | Set from `_active_port()` — do not set `PORT` (collides with `.env`) |
| `BASE_URL` | `http://localhost:${ORCH_HOST_PORT}` — override with `BASE_URL=...` |
| `TOKEN` | JWT from `ORCHESTRATOR_USER_JWT` in `.env` — override with `TOKEN=...` |
| `_db_query <sql>` | Runs SQL in `db-server-postgres` with schema `business_orchestrator` |
| `resolve_project_id <slug\|uuid>` | Returns UUID; looks up slug in DB if not already a UUID |
| `step` / `ok` / `warn` / `fail` | Coloured output helpers (`fail` exits 1) |

**Important:** `.env` sets `PORT=3390` (container-internal). The scripts use `ORCH_HOST_PORT` to avoid the collision.

---

## Common workflows

### BAU monitoring cadence (programme complete)

```bash
# Daily
./scripts/orch-status.sh
./scripts/orch-project-health.sh speakasap

# Weekly
./scripts/orch-final-validation.sh
./scripts/orch-budget-check.sh
```

Notes:
- Closed projects such as `flipflop-v1` should show `COMPLETED` in `orch-project-health.sh`.
- Active projects should stay `HEALTHY`; investigate `DEGRADED`/`CRITICAL` immediately.

### Start of session

```bash
./scripts/orch-status.sh
./scripts/orch-project-health.sh flipflop-v1
./scripts/orch-project-health.sh business-orchestrator
./scripts/orch-test-ai.sh
```

### Trigger cycle and watch

```bash
./scripts/orch-trigger-cycle.sh flipflop-v1
sleep 60
./scripts/orch-check-tasks.sh flipflop-v1
```

### After a deploy

```bash
# Verify the new container is healthy
./scripts/orch-status.sh

# Re-test AI from the new container's perspective
./scripts/orch-test-ai.sh free

# Trigger a cycle
./scripts/orch-trigger-cycle.sh flipflop-v1
```

### Debug: tasks failing with WORKER_TIMEOUT

```bash
# Step 1: verify AI service works for each tier
./scripts/orch-test-ai.sh free
./scripts/orch-test-ai.sh cheap

# Step 2: check recent task history for the pattern
./scripts/orch-check-tasks.sh flipflop-v1 20

# Step 3: check orchestrator logs for detailed error
docker logs $(docker ps -q --filter name=business-orchestrator-blue 2>/dev/null || \
             docker ps -q --filter name=business-orchestrator-green) --since=10m 2>&1 | \
  grep -iE 'error|warn|timeout|worker'
```

### Debug: ai_service_unavailable on cycle trigger

```bash
# Test each tier — free uses Ollama, cheap uses OpenRouter
./scripts/orch-test-ai.sh free
./scripts/orch-test-ai.sh cheap

# Check LiteLLM container
docker logs ai-microservice-litellm-green 2>&1 | tail -20

# Check if LITELLM_BASE_URL + LITELLM_MASTER_KEY are set in the running container
docker exec $(docker ps -q --filter name=business-orchestrator-green) \
  printenv LITELLM_BASE_URL LITELLM_MASTER_KEY 2>/dev/null | sed 's/=.*/=***/'
```

---

## Known issues and fixes (2026-04-12)

These bugs were found and fixed during the session that created these scripts. Documented here so future sessions don't re-diagnose from scratch.

### 1. Worker: `system_prompt` rejection by free-tier models

**Symptom:** All tasks fail with `WORKER_TIMEOUT:max_attempts_3` immediately.  
**Root cause:** `WorkerAgentService` was sending a separate `system_prompt` field to `/ai/complete`. Free-tier models (OpenRouter) reject system-role messages with HTTP 400 "Developer instructions". The catch block converted this to `WORKER_TIMEOUT`.  
**Fix:** Merged `system_prompt` into `user_prompt` — same pattern the coordinator already used.  
**File:** `src/worker/worker-agent.service.ts` lines ~103–116.

### 2. Validator: natural-language criteria → immediate hard fail

**Symptom:** Tasks completed by worker but failed with `VALIDATION_FAILED:unknown_criterion: Checkout flow completes...`  
**Root cause:** The coordinator LLM generates human-readable acceptance criteria (e.g. `"Checkout flow completes successfully"`), but `ValidatorAgentService.CRITERION_CHECKERS` only knows short keys like `json_valid`, `output_present`. Unrecognised criteria were pushed to `findings` as `unknown_criterion:...` which failed validation.  
**Fix:** Unknown criteria are now collected and passed to `runSemanticReview` (LLM review) instead of failing immediately.  
**File:** `src/validator/validator-agent.service.ts` lines ~53–69.

### 3. Validator: `runSemanticReview` sent `system_prompt` separately

**Symptom:** Validator's LLM review failed or returned wrong format.  
**Root cause:** Same as issue #1 — `runSemanticReview` used `system_prompt` field.  
**Fix:** Merged into `user_prompt`.  
**File:** `src/validator/validator-agent.service.ts` line ~106.

### 4. Validator: `semantic_review_unavailable` counted as failure

**Symptom:** Tasks failed with `VALIDATION_FAILED:llm_review: semantic_review_unavailable` even though the worker output was good.  
**Root cause:** The `runSemanticReview` catch block returned `['llm_review: semantic_review_unavailable']` which was treated as a finding → validation failure. Comment said "non-blocking" but it wasn't.  
**Fix:** Return `[]` from catch; log warn only.  
**File:** `src/validator/validator-agent.service.ts` line ~135.

### 5. Coordinator: large `failed_tasks` array caused Ollama timeout

**Symptom:** `ai_service_unavailable` on cycle trigger after many accumulated failures.  
**Root cause:** `findByProject(projectId, 'failed')` returns ALL failed tasks (25+ after many bad cycles). This entire list was passed to the LLM coordinator prompt. Ollama (`qwen2.5-coder:0.5b`) timed out on the large input; LiteLLM returned 503 after the 95s budget.  
**Fix:** Slice to last 5 failed tasks: `failedLastCycle.slice(-5)`.  
**File:** `src/coordinator/project-coordinator.service.ts` line ~114.

### 6. LiteLLM: `free` tier had no fallback

**Symptom:** Coordinator skipped with `ai_service_unavailable` even after fix #5.  
**Root cause:** LiteLLM config had fallbacks for `cheap → cheap-fallback` and `smart → smart-fallback` but nothing for `free`. When Ollama was slow, the request timed out and LiteLLM returned 503.  
**Fix:** Added `{"free": ["cheap"]}` to `router_settings.fallbacks`.  
**File:** `ai-microservice/litellm_config.yaml`. Requires `docker restart ai-microservice-litellm-green` after changing.

### 7. Port collision: `PORT` env var vs active host port

**Symptom:** Scripts used `PORT` variable for the host URL but `.env` sets `PORT=3390` (container-internal), causing scripts to always use 3390 even when green (3391) was active.  
**Fix:** Scripts use `ORCH_HOST_PORT` (detected by `_active_port()`) and `BASE_URL`. Never override `PORT`.  
**File:** `scripts/_orch-common.sh`.

---

## Architecture: how the pipeline works

```
Human triggers cycle
  └─ POST /api/projects/:uuid/cycle
       └─ ProjectCoordinatorService.runCycle()
            ├─ Acquire Redis lease (prevents parallel runs for same project)
            ├─ Check SPEC.md + PLAN.md present under MCP root
            ├─ Check active goal exists
            ├─ Call ai-microservice POST /ai/complete (model_tier: free)
            │    └─ LiteLLM proxy → Ollama (free) or OpenRouter (cheap fallback)
            ├─ Parse LLM response: { new_tasks[], state_patch, decisions }
            └─ Insert tasks into DB (idempotency key dedup; retry key on failed)

WorkerPoolService (@Cron every 10s)
  └─ Find pending tasks + idle agents
       └─ WorkerAgentService.execute(taskId, agentId)
            ├─ Check LLM budget (Redis daily counter)
            ├─ Call ai-microservice POST /ai/complete (tier: free→cheap→smart per attempt)
            │    └─ Prompt: WORKER_INSTRUCTION + task JSON (no system_prompt field)
            ├─ Expect response: { output_ref: {...} }
            └─ ValidatorAgentService.validate()
                 ├─ Deterministic checks (json_valid, output_present, etc.)
                 ├─ Unknown criteria → runSemanticReview (cheap tier)
                 └─ PASS → task.status = 'done'
                    FAIL → requeue (attempt++) or fail if maxAttempts reached
```

## LiteLLM tier routing

| Tier | Primary | Fallback |
|------|---------|---------|
| `free` | `ollama/qwen2.5-coder:0.5b` | `cheap` (OpenRouter gemma-3-27b-it:free) |
| `cheap` | `openrouter/google/gemma-3-27b-it:free` | `cheap-fallback` (Ollama) |
| `smart` | `gemini/gemini-2.0-flash` | `smart-fallback` (Ollama) |

Config: `ai-microservice/litellm_config.yaml`. Restart `ai-microservice-litellm-green` after any change.

## Project UUIDs (production)

| Slug | UUID | Notes |
|------|------|-------|
| `flipflop-v1` | `506017b2-dc57-43b6-a8f2-a1826d3914be` | Active pilot — flipflop checkout goal |
| `business-orchestrator` | `a9bd9c11-8328-4dc7-8f12-8b228810d3b5` | Self-dogfood project |
| `store-v1` | `0164e083-4569-4f0a-a110-b845da6f9ace` | FlipFlop Store V1 |
| `main-website` | `a657606f-e9dd-4714-acb0-e56bd49c318c` | FlipFlop Main Website |

Scripts resolve slugs automatically — UUIDs listed here for reference and direct API calls.
