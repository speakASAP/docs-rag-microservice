# Agent Reference: business-orchestrator

System live in production since 2026-04-16. Build-phase agent specs (AGENT01–AGENT93) removed 2026-04-29 — source code is the authoritative implementation reference.

## Agent Roster

| Agent | Module | Model tier | Role |
|-------|--------|-----------|------|
| GlobalCoordinator | `coordinator` | smart (15min tick, max 50 businesses, 60s lease) | Selects ≤5 projects/tick across all businesses; leader lease via Redis |
| ProjectCoordinator | `coordinator` | cheap (60min cycle, max 10 tasks, 5min debounce) | Runs LLM cycle per project; creates/assigns tasks; patches state snapshot |
| WorkerAgent | `worker` | free (max 20 concurrent, 900s timeout, 30s heartbeat) | Executes individual tasks; routes `{service}:{op}` types cross-service |
| ValidatorAgent | `validator` | free + cheap semantic (max 2 revisions) | JSON Schema deterministic + LLM semantic review |
| CodingWorkerAgent | `worker/coding` | smart (plan), free (revision) | On-demand via WorkerPool. Handles `type: coding` tasks using a 3-phase pipeline: (1) LLM generates a DAG of file-level steps, (2) each step executes with test-run-fix revision loop (max 2 retries/step), (3) deploy.sh + health check. Max 3 task-level attempts, then escalates. Emits `coding_step_progress` events per step. Blacklist: `auth-microservice`, `payments-microservice`, `database-server`. |

## Key architectural decisions

- **Leader leasing** (ADR-001): Redis TTL prevents concurrent coordinators — see `docs/adr/001-leader-leasing.md`
- **Idempotency** (ADR-002): SHA256 keys on tasks prevent duplicate execution on crash-and-replay
- **State sync** (ADR-003): PostgreSQL is authoritative; `STATE.json` is a synced cache
- **Retry classes** (ADR-004): TRANSIENT → SCHEMA_FAIL → MODEL_DEGRADED → PERMANENT with budget limits
- **Coding agent pipeline** (ADR-005): DAG-based planning, step-level revision loops, progress streaming — see `docs/adr/005-autonomous-coding-agents.md`. Enhancements tracked in `docs/superpowers/plans/2026-05-04-coding-agent-enhancements.md`.
- **Prompt merging**: All LLM calls merge system instructions into `user_prompt` — free/cheap tiers reject `system_prompt` field
- **No premium tier**: Premium model usage requires explicit human approval before any call

## Active tenants (BAU)

- `speakasap` — active, healthy
- `flipflop-v1` — COMPLETED, no active goals
