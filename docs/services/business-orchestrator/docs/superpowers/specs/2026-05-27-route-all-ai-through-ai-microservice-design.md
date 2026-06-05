---
name: route-all-ai-through-ai-microservice
description: All AI calls in business-orchestrator must route through ai-microservice POST /ai/complete — no service may call CC CLI or AI providers directly
metadata:
  type: project
---

# Route All AI Through ai-microservice — Design Spec

## Goal

Every AI inference call in business-orchestrator routes through `ai-microservice POST /ai/complete`, which in turn calls CC CLI. No service may invoke the Claude CLI or any AI provider SDK directly.

## Current State

| Service | Current path | Correct? |
|---|---|---|
| `WorkerAgentService` | `AiHttpClient` → ai-microservice | ✅ |
| `CodingWorkerAgentService` | `AiHttpClient` → ai-microservice | ✅ |
| `ValidatorAgentService` | bare `axios.post` → ai-microservice | ✅ |
| `GlobalCoordinatorService` | bare `axios.post` → ai-microservice | ✅ |
| `CcPlannerService` | `shell.run("claude --print")` → CC CLI directly | ❌ |
| `GoalReviewService` | `shell.run("claude --print")` → CC CLI directly | ❌ |

## Target State

`CcPlannerService` and `GoalReviewService` both replaced their direct CLI calls with `AiHttpClient.call()`.

## Architecture

### CcPlannerService

- **Remove**: `ShellExecService` (CC CLI usage only), `cliPath`, `timeoutMs` config fields, tmp-file I/O, `extractJson()`, manual JSON parse
- **Add**: `AiHttpClient` injected via constructor
- `plan()` builds prompt string identically to before, then calls `AiHttpClient.call()` with `model_tier: 'smart'`, the prompt as `user_prompt`, an explicit `output_schema`, and `correlation_id: input.projectId`
- Response: `AiHttpClient` returns fields spread at top level — `new_tasks`, `state_patch`, `decisions` extracted directly

### GoalReviewService

- **Remove**: `ShellExecService` for CC CLI call (still needed for `gh` commands), `cliPath`, `timeoutMs`, tmp-file I/O, `extractJson()`, manual JSON parse
- **Add**: `AiHttpClient` injected via constructor
- `runReview()` builds prompt string identically to before, then calls `AiHttpClient.call()` with `model_tier: 'smart'`, `output_schema` matching `CcReviewResponse` shape
- Response fields (`verdict`, `summary`, `findings`, etc.) extracted from returned object directly
- `ShellExecService` kept only for `gh issue create`, `gh pr create`, `gh api` shell calls

### Module Wiring

Both `CcPlannerModule` and `GoalReviewModule` must import `WorkerModule` (which provides and exports `AiHttpClient`) — or register `AiHttpClient` + its deps directly.

## Benefits

- Single execution path: all inference through CC CLI subscription via ai-microservice
- Token budget tracking applies to planner and reviewer calls
- Circuit breaker and Redis response cache apply automatically
- `CC_CLI_PATH` config lives in one place (ai-microservice configmap)

## Out of Scope

- Refactoring `ValidatorAgentService` or `GlobalCoordinatorService` to use `AiHttpClient` (they already call ai-microservice correctly, just via bare axios — acceptable)
- Changes to ai-microservice itself
