# JSON Contract Enforcement — Design Spec

**Date:** 2026-05-28  
**Status:** Approved  
**Scope:** business-orchestrator (`src/`)

---

## Goal

Every JSON data flow — AI response and HTTP boundary — must pass through a Zod schema before any field is accessed or returned. No raw casts, no alias fallbacks, no `as any`. Violations throw structured errors that are logged and surfaced to the caller.

---

## Principles

1. Every `aiHttp.call()` result must pass a Zod `safeParse` before any field is accessed.
2. Every controller POST/PATCH/DELETE response must be Zod-validated before returning.
3. ALL boundaries use `parseOrThrow` — no silent degradation, no fallback to raw data. A contract violation always throws, always alerts the user via notifications-microservice, and halts the flow.
4. All schemas live in `src/contracts/` — one file per domain.
5. `parseOrThrow` / `parseOrWarn` are the only entry points for validation — no inline `if (!check.success)` blocks in services.
6. `schemaVersion: '1.0'` on AI contracts (already established). HTTP response contracts omit it.
7. HTTP response schemas use default Zod strict mode (extra fields stripped). AI contracts use `.passthrough()` (model may add metadata fields).

---

## New Files

```
src/contracts/
  parse-or-throw.ts             NEW
  contract-violation.error.ts   NEW
  coordinator.contract.ts       NEW
  goal-review.contract.ts       NEW
  coding-worker.contract.ts     NEW
  http-responses.contract.ts    NEW
  index.ts                      UPDATED (re-exports all new schemas)
```

---

## Shared Infrastructure

### `contract-violation.error.ts`

```ts
import { ZodIssue } from 'zod';

export class ContractViolationError extends Error {
  constructor(
    readonly context: string,
    readonly issues: ZodIssue[],
  ) {
    super(`contract_violation:${context}`);
  }
}
```

NestJS global exception filter maps `ContractViolationError` to HTTP 500 with body `{ error: 'contract_violation', context, issues }`.

**On every `ContractViolationError` the exception filter also fires a notification** via `notifications-microservice` (`POST /notifications/send`) with:
- `level: 'critical'`
- `title: 'Contract violation: <context>'`
- `body`: the Zod issues serialized as a readable string

This ensures the operator is alerted immediately. No flow continues past a violation — no retries, no fallbacks.

### `parse-or-throw.ts`

```ts
parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, context: string): T
```
- Calls `schema.safeParse(data)`
- On failure: throws `ContractViolationError(context, issues)`
- On success: returns typed `result.data`

**No `parseOrWarn`.** Every violation throws. The notification pattern below handles user alerting.

---

## AI Boundary Gaps — Fixes

### 1. `ProjectCoordinatorService`

**File:** `src/coordinator/project-coordinator.service.ts`

**Current:** Raw alias fallbacks (`raw.new_tasks ?? raw.newTasks`, state_patch promotion, `normalizeCoordinatorTaskSpec`), no schema check.

**Fix:**
- After `extractStructuredOutput()`, normalize aliases into canonical field names (`new_tasks`, `state_patch`, `decisions`)
- Run `parseOrThrow(CcPlannerOutputSchema, normalized, 'coordinator.cycle')`
- Remove ad-hoc alias fallbacks and `normalizeCoordinatorTaskSpec()` — schema validation replaces them
- Keep `validateCodingPlan()` DAG topology check downstream (Zod cannot express graph invariants)

### 2. `GlobalCoordinatorService`

**File:** `src/coordinator/global-coordinator.service.ts`

**Current:** `(aiData['projects_to_run'] ?? []) as string[]` direct cast.

**Fix:**
- Add `GlobalCoordinatorResponseSchema` to `coordinator.contract.ts`
- Run `parseOrThrow(GlobalCoordinatorResponseSchema, aiData, 'global_coordinator.tick')` after `extractStructuredOutput()`

**Schema:**
```ts
GlobalCoordinatorResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  projects_to_run: z.array(z.string()).max(5),
  decisions: z.array(z.string()),
})
```

### 3. `GoalReviewService`

**File:** `src/goal-review/goal-review.service.ts`

**Current:** Maps AI response via `String(response['verdict'] ?? '')` casts to local `CcReviewResponse` interface.

**Fix:**
- Add `CcReviewResponseSchema` to `goal-review.contract.ts`
- Replace manual mapping with `parseOrThrow(CcReviewResponseSchema, response, 'goal_review.review')`
- Remove local `CcReviewResponse` interface — use `z.infer<typeof CcReviewResponseSchema>`

**Schema:**
```ts
CcFindingSchema = z.object({
  severity: z.enum(['low', 'medium', 'high']),
  area: z.string(),
  description: z.string(),
  evidence: z.string(),
})

CcProposedChangeSchema = z.object({
  file: z.string(),
  description: z.string(),
  diff_hint: z.string(),
})

CcReviewResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  verdict: z.enum(['ok', 'needs_improvement']),
  summary: z.string(),
  cc_approach: z.string(),
  findings: z.array(CcFindingSchema).default([]),
  proposed_changes: z.array(CcProposedChangeSchema).default([]),
  pr_title: z.string().default(''),
  pr_body: z.string().default(''),
  wiki_entry: z.string().default(''),
}).passthrough()
```

### 4. `CodingWorkerAgentService`

**File:** `src/coding-worker/coding-worker-agent.service.ts`

**Current:** Response passed directly to `validateCodingPlan()` via `as unknown as CodingPlan`.

**Fix:**
- Add `CodingStepSchema` + `CodingPlanSchema` (Zod) to `coding-worker.contract.ts`
- Run `parseOrThrow(CodingPlanSchema, response, 'coding_worker.build_plan')` first
- Then pass Zod-typed result to `validateCodingPlan()` for DAG topology check
- Replace `CodingStep` / `CodingPlan` interfaces in `coding-plan.types.ts` with `z.infer<>` types

**Schema:**
```ts
CodingStepSchema = z.object({
  id: z.string().min(1),
  depends_on: z.array(z.string()),
  file: z.string().min(1),
  description: z.string().min(1),
  action: z.enum(['create', 'modify', 'delete']),
  status: z.enum(['pending', 'done', 'failed']).optional(),
})

CodingPlanSchema = z.object({
  steps: z.array(CodingStepSchema).min(1),
})
```

---

## HTTP Response Contracts

**File:** `src/contracts/http-responses.contract.ts`

All schemas use default Zod (no `.passthrough()`). Extra fields from DB entities are stripped before returning.

### Schemas

| Schema | Controller | Method |
|--------|-----------|--------|
| `TaskResponseSchema` | `TasksController` | `findOne` |
| `TaskListItemSchema` | `TasksController` | `findAll` |
| `ExecutionSummarySchema` | embedded in `TaskResponseSchema` when `include=executions` |
| `ProjectCardSchema` | `DashboardController` | `overview` |
| `DashboardOverviewSchema` | `DashboardController` | `overview` |
| `GoalResponseSchema` | `GoalsController` | all methods |
| `ProjectResponseSchema` | `ProjectsController` | all methods |
| `ExecutionResponseSchema` | `ExecutionsController` | all methods |
| `AgentResponseSchema` | `AgentsController` | all methods |
| `EscalationResponseSchema` | `EscalationsController` | all methods |
| `MetricsResponseSchema` | `MetricsController` | all methods |
| `HealthResponseSchema` | `HealthController` | `check` |
| `DigestResponseSchema` | `DigestController` | all methods |

### Enforcement pattern

```ts
// ALL endpoints — always throw, never silently degrade
return parseOrThrow(TaskResponseSchema, base, 'tasks.findOne');
```

---

## Testing

### `src/contracts/contracts.spec.ts` additions

For each new schema:
- Happy path: valid minimal object passes
- Missing required field: `safeParse` returns `success: false`
- Wrong type on key field: rejected
- Extra fields: accepted on AI contracts (`.passthrough()`), stripped on HTTP contracts

### `src/contracts/parse-or-throw.spec.ts` (new file)

- `parseOrThrow` throws `ContractViolationError` on invalid input
- `parseOrThrow` returns typed data on valid input
- `ContractViolationError` carries context string and Zod issues

### Existing tests

No changes — all current `contracts.spec.ts` cases are preserved.

---

## Out of Scope

- Pagination schemas for large list endpoints (GET all tasks, full execution history) — TypeScript types sufficient, runtime validation cost not justified
- WebSocket message contracts (`DashboardGateway`) — separate concern
- Database entity shapes — ORM handles this
