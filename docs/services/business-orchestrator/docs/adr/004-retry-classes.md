# ADR-004: Task Retry Classification

**Status:** Accepted | **Date:** 2026-04-04

## Context

Not all task failures are equal. Retrying a permanent failure wastes LLM budget and stalls the project. But treating a transient network error as permanent causes unnecessary escalation. We need a classification scheme that drives different retry behaviors.

## Decision

### Failure Classes

| Class | Code | Meaning | Retry Behavior |
|-------|------|---------|----------------|
| `TRANSIENT` | `WORKER_TIMEOUT`, `RATE_LIMIT`, `MCP_TIMEOUT` | Temporary infrastructure issue | Retry immediately, same model tier |
| `SCHEMA_FAIL` | `OUTPUT_SCHEMA_INVALID`, `CRITERIA_UNMET` | Worker produced wrong shape | Retry with `revision_hint` injected into spec, same tier |
| `MODEL_DEGRADED` | `MODEL_ERROR`, `EMPTY_OUTPUT`, `REPETITION_LOOP` | Model produced unusable output | Retry at next higher model tier |
| `PERMANENT` | `TASK_TYPE_UNSUPPORTED`, `MCP_AUTH_FAIL`, `DEPENDENCY_MISSING` | Structural issue — retrying won't help | Fail immediately, escalate |

### Retry Budget per Class

```
TRANSIENT:       up to max_attempts, no tier change, 5s/15s/30s backoff
SCHEMA_FAIL:     up to max_attempts, inject revision_hint on attempt 2+
MODEL_DEGRADED:  attempt 1: free, attempt 2: cheap, attempt 3: smart → then fail
PERMANENT:       0 retries — immediate fail
```

### Error Code → Class Mapping

Orchestrator maintains a static mapping table. Worker returns `error_code`; orchestrator looks up class and applies policy.

Workers MUST return one of the defined `error_code` values. Free-form error strings are not accepted in the protocol (enforced by `agent-message.schema.json`).

### Model Escalation on MODEL_DEGRADED

```
attempt 1:  model_tier = free    (default)
attempt 2:  model_tier = cheap   (escalate)
attempt 3:  model_tier = smart   (escalate)
attempt 4+: → task.status = failed, blocked_reason = "model_degraded_max_attempts"
```

Cost of escalation is logged per execution so coordinator can deprioritize task types that frequently need `smart` tier.

### Circuit Breaker Trigger

If a project accumulates ≥10 `PERMANENT` failures within one cycle → suspend the project automatically and alert owner. Indicates a structural issue in `SYSTEM.md` or task generation logic.

### ValidatorAgent Retry

Validator-specific classes:

- `VERDICT_FAIL_STRUCTURAL` (wrong schema) → WorkerAgent retry with revision_hint
- `VERDICT_FAIL_SEMANTIC` → WorkerAgent retry (max 2 times) → then human escalation
- `VALIDATOR_INTERNAL_FAIL` → skip validation (`validation=skip`), log warning, proceed to done

## Consequences

- **Positive:** LLM budget not wasted on permanent failures
- **Positive:** Transient failures auto-resolve without human
- **Positive:** Escalation only when genuinely stuck
- **Negative:** Error code discipline required from all worker implementations
- **Negative:** Model escalation increases cost on `MODEL_DEGRADED` tasks — monitored via cost dashboard

## Alternatives Considered

- **Uniform max-retry for all classes:** Simple but wastes budget on permanent failures
- **AI-classified errors:** Rejected — adds LLM call overhead on every failure; error codes are deterministic
