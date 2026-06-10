---
title: CodingWorkerAgent — Autonomous Coding Agent in runlayer
date: 2026-04-29
status: approved
---

# CodingWorkerAgent Design

## Goal

Enable `runlayer` to autonomously write, deploy, and validate code changes across ecosystem services — no human involvement required during the execution phase. Humans review output after the fact via Telegram/email escalations and the orchestrator dashboard.

## Scope

**This spec (backend):** `CodingWorkerAgent`, `ShellExecModule`, DB schema extension, blacklist safety, retry/escalation logic.

**Follow-up spec (dashboard UI):** Coding task views, attempt history panel, deploy output viewer in the orchestrator dashboard.

---

## Architecture Overview

`CodingWorkerAgent` is a new agent type inside `runlayer`, sitting alongside the existing `WorkerAgent` pool. The existing task state machine gains a new task type: `type: coding`. When `ProjectCoordinator` creates a task with `type: coding`, it routes to `CodingWorkerAgent` instead of the generic `WorkerAgent`.

### Execution pipeline

```
ProjectCoordinator creates task (type: coding, target_service, goal, smoke_test_urls)
    ↓
CodingWorkerAgent acquires Redis lease (same pattern as WorkerAgent)
    ↓
[PLAN]     ai-microservice (smart tier) → structured plan: [{file, action, description}]
    ↓
[VALIDATE-STATIC]  ValidatorAgent:
                   - JSON Schema check on config/env changes
                   - Blacklist check: no direct calls to blacklisted services
                   - deploy.sh exists and is executable
    ↓ passes
[EXECUTE]  For each file in plan:
           mcp-filesystem read → ai-microservice (smart) generates content → mcp-filesystem write
    ↓
[DEPLOY]   ShellExecModule runs ~/Documents/Github/<target_service>/scripts/deploy.sh
           timeout: 300s, stdout/stderr captured
    ↓
[VALIDATE-RUNTIME]  curl /health (200 required)
                    curl each smoke_test_url (200 required)
    ↓
SUCCESS → task: completed, release lease, log to logging-microservice
    ↓ (on any failure at any step)
[RETRY]    coding_attempts++
           error + previous attempt context fed back to ai-microservice
           restart from [PLAN] step
           attempt 3: model downgrade smart → cheap
    ↓ (after 3rd failure)
[ESCALATE] notifications-microservice → Telegram + email
           task: failed, release lease
```

---

## New Modules

### `coding-worker` module

**`CodingWorkerAgent`** class — implements the same agent interface as `WorkerAgent`:
- Heartbeat (30s interval, same as WorkerAgent)
- Redis lease acquisition and release
- Task state machine transitions (`pending → in_progress → completed/failed`)

Key methods:
- `plan(task)` — calls ai-microservice to decompose goal into `[{file, action, description}]`
- `execute(plan)` — iterative read→generate→write loop via mcp-filesystem
- `deploy(targetService)` — delegates to ShellExecModule
- `validateRuntime(healthUrl, smokeTestUrls)` — curl checks
- `retry(task, error, attempt)` — rebuilds prompt with error context, reruns from plan
- `escalate(task, errorLog)` — calls notifications-microservice

### `shell-exec` module

**`ShellExecModule`** — thin wrapper around Node.js `child_process.spawn`:
- Runs only `deploy.sh` — no arbitrary shell commands from LLM output ever executed
- Enforces 300s timeout
- Captures full stdout/stderr, stored in `coding_error_log`
- Used exclusively by `CodingWorkerAgent` — no other agent has shell access

---

## DB Schema Extension

The `tasks` table already has a `type TEXT NOT NULL` column (migration 003). New additive columns only:

```sql
ALTER TABLE runlayer.tasks
  ADD COLUMN target_service VARCHAR(100),
  ADD COLUMN smoke_test_urls JSONB DEFAULT '[]',
  ADD COLUMN coding_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN coding_plan JSONB,
  ADD COLUMN coding_error_log JSONB DEFAULT '[]';
```

Coding tasks use `type = 'coding'` — no schema change needed for the type field itself.

`coding_error_log` stores per-attempt objects:
```json
[
  {
    "attempt": 1,
    "step": "deploy",
    "error": "deploy.sh exited with code 1",
    "stderr": "...",
    "plan": [{"file": "...", "action": "...", "description": "..."}]
  }
]
```

All attempts logged immutably to the existing `executions` table with `phase` set to `coding-attempt-N`.

---

## Safety Constraints

### Blacklist

`CODING_AGENT_BLACKLIST` env var (comma-separated).  
**Default:** `auth-microservice,payments-microservice,database-server`

Checked at two points:
1. **Task intake** — `ProjectCoordinator` rejects task creation immediately with `BLACKLISTED` status
2. **Before first filesystem write** — `CodingWorkerAgent` double-checks before executing plan

Task with `target_service` on the blacklist never reaches the deploy step.

### Shell isolation

- `ShellExecModule` only accepts a service name and resolves it to `~/Documents/Github/<service>/scripts/deploy.sh`
- Path is constructed server-side — LLM output never influences the shell command string
- No `eval`, no arbitrary commands, no LLM-provided shell strings ever executed

### Filesystem scope

- `mcp-filesystem` writes scoped to `~/Documents/Github/<target_service>/` only
- No writes outside the target repo directory

### Model budget

| Attempt | Planning model | Code generation model |
|---------|---------------|----------------------|
| 1       | smart         | smart                |
| 2       | smart         | smart                |
| 3       | cheap         | cheap                |

Hard cap: `coding_attempts` max 3. No infinite retry loops.

---

## Retry & Escalation

### Retry prompt construction

Each retry injects:
- Original goal
- Previous attempt's `coding_plan`
- Error output from failed step (deploy stderr / health check response)
- Instruction: "The previous attempt failed. Here is what went wrong. Revise the plan and fix the issue."

### Escalation notification

Sent via `POST /notifications/send` to `notifications-microservice`:

```
Coding task FAILED after 3 attempts

Service: <target_service>
Goal: <task goal>
Last error: <error summary from coding_error_log[2]>
Attempts: 3/3

Review: https://runlayer.alfares.cz/tasks/<id>
```

Channels: Telegram + email (uses existing `TELEGRAM_CHAT_ID` + `EMAIL_TO` env vars).

---

## Scheduling & Triggering

No new scheduler needed. `CodingWorkerAgent` joins the existing task queue:

- **Scheduled**: `GlobalCoordinator` (15-min cron tick) picks up `type: coding` tasks from the queue like any other task
- **On-demand**: existing `POST /api/tasks` dashboard endpoint accepts `type: coding` with new fields

`ProjectCoordinator` creates coding tasks the same way it creates standard tasks — just with `type: coding` and the additional fields populated.

---

## Observability

All events logged to `logging-microservice` under source tag `coding-agent`:
- Plan generated (file list)
- Each file write (filename, action)
- Deploy stdout/stderr (full capture)
- Each validation result (URL, status code)
- Retry triggered (attempt N, error summary)
- Escalation sent

Existing `executions` table records every LLM call (prompt + response) for full audit trail.

---

## Out of Scope (this spec)

- Dashboard UI coding task views → follow-up spec
- Git branching / PR workflow (direct-to-production per user requirement)
- Multi-service tasks (one `target_service` per task)
- Cursor SDK / cloud agent integration (not needed — Option C is self-contained)

---

## Follow-up Spec

**`2026-04-29-coding-agent-dashboard-ui-design.md`** (to be written):
- Coding task badge + attempt counter in task list rows
- Execution log: plan steps panel, attempt history, deploy output viewer
- WebSocket events: `coding.attempt.started`, `coding.attempt.failed`
- Agents view: CodingWorkerAgent instances with type label + current task link
