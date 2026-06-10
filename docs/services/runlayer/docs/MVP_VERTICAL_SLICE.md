# MVP Vertical Slice — Phase 1 Specification

**Scope:** Single business, single project, single complete agent loop.
**Goal:** 5 worker tasks complete autonomously in one cycle without human intervention.

---

## Included in MVP

| Component                    | Included | Notes                                           |
| ---------------------------- | -------- | ----------------------------------------------- |
| `Business` CRUD              | Yes      | Create, read, pause, archive                    |
| `Project` CRUD               | Yes      | Create, read; only one active project           |
| `Agent` lifecycle            | Partial  | Worker + Coordinator only; no GlobalCoordinator |
| `Task` lifecycle             | Full     | All states: created → done/failed               |
| `Execution` recording        | Yes      | Per-attempt, with tokens + duration             |
| `ProjectCoordinator`         | Yes      | Cheap model (Ollama); manual trigger only       |
| `WorkerAgent` pool           | Yes      | Max 3 concurrent; free model                    |
| `ValidatorAgent`             | Yes      | JSON Schema only (deterministic, no LLM)        |
| `GlobalCoordinator`          | Stubbed  | Rule-based stub; real impl in Phase 2           |
| RabbitMQ events              | Yes      | task.created, task.completed, task.failed only  |
| `logging-microservice`       | Yes      | All structured logs with duration_ms            |
| `notifications-microservice` | Yes      | Escalation only (Telegram)                      |
| `auth-microservice`          | Yes      | JWT for dashboard API                           |
| `mcp-filesystem`             | Yes      | Read SYSTEM.md, write STATE.json                |
| `postgres`               | Yes      | Worker task I/O                                 |
| `mcp-git`                    | No       | Phase 2                                         |
| `mcp-playwright`             | No       | Phase 2                                         |
| Dashboard UI                 | Minimal  | Read-only: health card + task list              |
| Cost tracking                | Yes      | Token count per execution                       |
| Budget enforcement           | No       | Phase 2                                         |

---

## API Endpoints (MVP Scope)

```text
POST   /businesses                    Create a business
GET    /businesses/:id                Get business

POST   /businesses/:id/projects       Create a project
GET    /businesses/:id/projects/:pid  Get project + state_snapshot

POST   /projects/:id/cycle            Manually trigger a coordinator cycle
GET    /projects/:id/tasks            List tasks with status filter
GET    /projects/:id/tasks/:tid       Get task + executions

GET    /agents                        List active agents
GET    /agents/:id                    Get agent + heartbeat

GET    /dashboard                     Owner overview (all businesses)
```

All endpoints require JWT (auth-microservice). No public routes.

---

## Cycle Flow (Manual Trigger)

```text
POST /projects/:id/cycle
  │
  ▼
Orchestrator: check project status = active
  │
  ▼
Acquire coordinator lease (Redis NX)
  │
  ▼
Read state_snapshot from DB
  │
  ▼
ProjectCoordinator.run(state, available_workers=3)
  → LLM call (cheap model via ai-microservice)
  → Output: new_tasks[], state_patch
  │
  ▼
Create task rows in DB (with idempotency_key check)
Emit task.created events
  │
  ▼
Dispatch tasks to WorkerAgent pool (Redis queue)
  │
  ▼
Workers execute (parallel, max 3)
  → MCP calls for I/O
  → ONE LLM call per worker (free model via ai-microservice)
  → Return TASK_RESULT
  │
  ▼
ValidatorAgent.validate(output_ref, acceptance_criteria)
  → Deterministic JSON Schema check (no LLM)
  → Return VERDICT
  │
  ▼
task.status = done | failed
Emit task.completed | task.failed
  │
  ▼
Coordinator applies state_patch to DB
Sync STATE.json via mcp-filesystem
Emit project.updated
  │
  ▼
Release coordinator lease
Return cycle summary to API caller
```

---

## ai-microservice Integration

All LLM calls route through `ai-microservice` (`http://ai-microservice:3380`).

Request format (JSON):

```json
{
  "model_tier": "free | cheap | smart",
  "system_prompt": "<structured instructions>",
  "user_prompt": "<task spec JSON>",
  "output_schema": {"<JSON Schema>"},
  "max_tokens": 600,
  "correlation_id": "uuid"
}
```

`ai-microservice` selects the actual model based on `model_tier`:

- `free` → Ollama (local, $0)
- `cheap` → OpenRouter free tier
- `smart` → Gemini Flash or Claude Haiku

Orchestrator does NOT know which model was used. It logs `model_used` from the response.

---

## Logging Standard (logging-microservice)

Every significant operation emits a structured log:

```json
{
  "service": "runlayer",
  "level": "info | warn | error",
  "msg": "task_completed",
  "correlation_id": "uuid",
  "business_id": "uuid",
  "project_id": "uuid",
  "task_id": "uuid",
  "agent_id": "uuid",
  "duration_ms": 4200,
  "timestamp": "2026-04-04T10:00:00.000Z",
  "metadata": {
    "model_used": "gemma2:2b",
    "tokens": 320,
    "attempt": 1
  }
}
```

Required `duration_ms` on all operations (coordinator cycle, worker execution, validator check, MCP calls).

---

## Failure Handling (MVP Scope)

| Failure                           | Response                                        |
| --------------------------------- | ----------------------------------------------- |
| Worker timeout                    | Mark execution `timeout`; retry (max 3)         |
| Worker schema fail                | Retry with revision_hint (max 2)                |
| Worker permanent fail             | task.failed → coordinator logs, no retry        |
| Validator fail                    | Retry worker once; if fails again → task.failed |
| Coordinator LLM fail              | Log error, abort cycle, release lease           |
| DB write conflict (state_version) | Coordinator re-reads, retries cycle             |
| Worker pool empty                 | Tasks queued, retried on next cycle trigger     |

No human escalation in MVP (wired but only emits to Telegram on `critical` health).

---

## Validation Criterion

> **MVP is complete when:** A manual `POST /projects/:id/cycle` for the `flipflop` project creates 5 tasks, all complete with `done` status, `STATE.json` is updated with correct `tasks_active` and `cycle` counter, and all events appear in `logging-microservice`.

---

## Out of Scope for MVP (deferred to Phase 2)

- GlobalCoordinator autonomous scheduling (cron)
- Budget enforcement
- mcp-git, mcp-playwright
- Multi-business concurrency
- Dashboard real-time WebSocket
- Escalation Center UI
- Semantic ValidatorAgent (LLM validation)
- Task batching
- Result caching
