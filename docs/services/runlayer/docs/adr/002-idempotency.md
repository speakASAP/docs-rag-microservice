# ADR-002: Task Idempotency Strategy

**Status:** Accepted | **Date:** 2026-04-04

## Context

`ProjectCoordinator` generates tasks during each cycle. If a cycle runs twice (crash-and-replay, retry after partial failure), it must not create duplicate tasks. Workers may also receive the same `ASSIGN_TASK` message twice (at-least-once delivery via RabbitMQ). Both surfaces require idempotency.

## Decision

### Task Creation Idempotency

Every task has an `idempotency_key` (unique per project). Coordinator derives the key deterministically from task inputs:

```
idempotency_key = sha256(project_id + task_type + stable_input_hash)[:16]
```

`stable_input_hash` is a hash of the task spec fields that define the work (excluding timestamps).

Database enforces uniqueness:

```sql
UNIQUE (project_id, idempotency_key)
```

On conflict:

- If existing task is `done` → return cached result immediately (skip execution)
- If existing task is `in_progress` or `assigned` → return existing task ID (no duplicate)
- If existing task is `failed` → create new task with incremented version suffix in key

### Worker Execution Idempotency

`Execution` table has a partial unique index:

```sql
UNIQUE (task_id, phase, attempt_number)
```

Worker receiving duplicate `ASSIGN_TASK` for same `(task_id, attempt_number)` → checks for existing active `Execution` row → skips redundant start.

### Output Idempotency

Workers write output to MCP targets with deterministic paths:

```
mcp:filesystem → /projects/{slug}/.orchestrator/tasks/{task_id}/output.json
mcp:postgres   → upsert using (task_id, attempt_number) as conflict key
```

Write is idempotent: re-writing the same output produces the same result.

### Short-lived Dedup Layer

Redis key `bo:dedup:{task_id}:{attempt}` with TTL 300s. Set before task dispatch; checked by orchestrator before re-dispatching. Prevents double-dispatch during worker restart storms.

## Consequences

- **Positive:** Safe cycle replay; coordinator can be restarted mid-cycle without duplicate work
- **Positive:** At-least-once RabbitMQ delivery becomes safe
- **Negative:** `idempotency_key` derivation must be stable — do not include timestamps or random values
- **Negative:** `failed` tasks need version-suffixed key to allow retry; coordinator must handle this

## Alternatives Considered

- **Dedup only in Redis:** Insufficient — TTL expiry would allow duplicates after restart
- **Outbox pattern for events:** Considered for event publishing; deferred to Phase 2
