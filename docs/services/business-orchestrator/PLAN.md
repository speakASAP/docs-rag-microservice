---
version: 2
---

# PLAN — business-orchestrator

## v2 (2026-04)

1. Goal management layer: HUMAN → GOAL → ORCHESTRATOR → TASKS.
2. Validator in worker path; `markDone` requires `_validation.passed`.
3. Transient retries with `maxAttempts`; terminal fail + escalation.
4. Pilot slug filter; daily digest via notifications-microservice (with goal progress) using `POST /notifications/send` for both Telegram (`channel=telegram`) and email (`channel=email`).
5. SPEC/PLAN/GOALS gate on coordinator cycles.
6. Anti-chaos rules: no agent-created goals, no tasks without goal_id.

## v1 (2026-04) — superseded

1. Validator in worker path.
2. Transient retries.
3. Pilot slug filter; daily digest.
4. SPEC/PLAN gate on coordinator cycles.
