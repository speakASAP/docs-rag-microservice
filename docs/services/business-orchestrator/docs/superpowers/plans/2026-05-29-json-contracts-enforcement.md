# JSON Contract Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce strict Zod contracts at every AI response and HTTP boundary — fail fast, alert user on every violation, no silent fallbacks.

**Architecture:** Add `ContractViolationError` + `parseOrThrow` as shared infrastructure, then wire Zod schemas at the 4 AI gap sites and all controller response paths. A new global NestJS exception filter catches `ContractViolationError`, sends a critical notification via `NotificationsClient`, and returns HTTP 500.

**Tech Stack:** NestJS, Zod, TypeScript, `NotificationsClient` (existing), `LoggingClient` (existing)

---

## File Map

| Action | File |
|--------|------|
| **CREATE** | `src/contracts/contract-violation.error.ts` |
| **CREATE** | `src/contracts/parse-or-throw.ts` |
| **CREATE** | `src/contracts/coordinator.contract.ts` |
| **CREATE** | `src/contracts/goal-review.contract.ts` |
| **CREATE** | `src/contracts/coding-worker.contract.ts` |
| **CREATE** | `src/contracts/http-responses.contract.ts` |
| **CREATE** | `src/common/filters/contract-violation.filter.ts` |
| **CREATE** | `src/contracts/parse-or-throw.spec.ts` |
| **MODIFY** | `src/contracts/index.ts` — re-export new schemas |
| **MODIFY** | `src/main.ts` — register global exception filter |
| **MODIFY** | `src/coordinator/global-coordinator.service.ts` — AI boundary fix |
| **MODIFY** | `src/coordinator/project-coordinator.service.ts` — AI boundary fix |
| **MODIFY** | `src/goal-review/goal-review.service.ts` — AI boundary fix |
| **MODIFY** | `src/coding-worker/coding-plan.types.ts` — replace interfaces with Zod inferred types |
| **MODIFY** | `src/coding-worker/coding-worker-agent.service.ts` — AI boundary fix |
| **MODIFY** | `src/tasks/tasks.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/dashboard/dashboard.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/goals/goals.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/projects/projects.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/executions/executions.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/agents/agents.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/escalations/escalations.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/metrics/metrics.controller.ts` — HTTP response contracts |
| **MODIFY** | `src/health.controller.ts` — HTTP response contract |
| **MODIFY** | `src/digest/digest.controller.ts` — HTTP response contract |
| **MODIFY** | `src/contracts/contracts.spec.ts` — add tests for new schemas |

---

## Task 1: ContractViolationError + parseOrThrow infrastructure

**Files:**
- Create: `src/contracts/contract-violation.error.ts`
- Create: `src/contracts/parse-or-throw.ts`
- Create: `src/contracts/parse-or-throw.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/contracts/parse-or-throw.spec.ts
import { z } from 'zod';
import { parseOrThrow } from './parse-or-throw';
import { ContractViolationError } from './contract-violation.error';

const TestSchema = z.object({ name: z.string(), age: z.number() });

describe('parseOrThrow', () => {
  it('returns typed data for valid input', () => {
    const result = parseOrThrow(TestSchema, { name: 'Alice', age: 30 }, 'test.ctx');
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  it('throws ContractViolationError for invalid input', () => {
    expect(() =>
      parseOrThrow(TestSchema, { name: 42, age: 'wrong' }, 'test.ctx'),
    ).toThrow(ContractViolationError);
  });

  it('ContractViolationError carries context and issues', () => {
    try {
      parseOrThrow(TestSchema, { name: 42 }, 'my.context');
    } catch (e) {
      expect(e).toBeInstanceOf(ContractViolationError);
      expect((e as ContractViolationError).context).toBe('my.context');
      expect((e as ContractViolationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('error message includes context', () => {
    try {
      parseOrThrow(TestSchema, {}, 'worker.build_plan');
    } catch (e) {
      expect((e as Error).message).toContain('contract_violation:worker.build_plan');
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest src/contracts/parse-or-throw.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: `Cannot find module './parse-or-throw'`

- [ ] **Step 3: Create ContractViolationError**

```typescript
// src/contracts/contract-violation.error.ts
import { ZodIssue } from 'zod';

export class ContractViolationError extends Error {
  constructor(
    readonly context: string,
    readonly issues: ZodIssue[],
  ) {
    super(`contract_violation:${context}`);
    this.name = 'ContractViolationError';
  }
}
```

- [ ] **Step 4: Create parseOrThrow**

```typescript
// src/contracts/parse-or-throw.ts
import { ZodSchema } from 'zod';
import { ContractViolationError } from './contract-violation.error';

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContractViolationError(context, result.error.issues);
  }
  return result.data;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/contracts/parse-or-throw.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/contracts/contract-violation.error.ts src/contracts/parse-or-throw.ts src/contracts/parse-or-throw.spec.ts
git commit -m "feat(contracts): add ContractViolationError and parseOrThrow infrastructure"
```

---

## Task 2: Global exception filter — notify + halt on contract violations

**Files:**
- Create: `src/common/filters/contract-violation.filter.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create the exception filter**

```typescript
// src/common/filters/contract-violation.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import { ContractViolationError } from '../../contracts/contract-violation.error';
import { NotificationsClient } from '../notifications/notifications.client';

@Catch(ContractViolationError)
@Injectable()
export class ContractViolationFilter implements ExceptionFilter {
  constructor(private readonly notifications: NotificationsClient) {}

  async catch(exception: ContractViolationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const issuesSummary = exception.issues
      .map((i) => `[${i.path.join('.')}] ${i.message}`)
      .join('; ');

    // Fire-and-forget alert — never suppress the HTTP response waiting for it
    this.notifications
      .escalate({
        level: 'critical',
        subject: `Contract violation: ${exception.context}`,
        body: `Contract violation detected at boundary "${exception.context}".\n\nIssues:\n${issuesSummary}\n\nThe flow has been halted. Please investigate immediately.`,
      })
      .catch(() => {
        // Notification failure must not mask the original error
      });

    response.status(500).json({
      error: 'contract_violation',
      context: exception.context,
      issues: exception.issues,
    });
  }
}
```

- [ ] **Step 2: Register the filter globally in main.ts**

Read `src/main.ts`, then update the bootstrap function:

```typescript
// src/main.ts  — replace the bootstrap function body
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', { exclude: ['health', 'metrics'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const notificationsClient = app.get(NotificationsClient);
  app.useGlobalFilters(new ContractViolationFilter(notificationsClient));

  const port = process.env.PORT || 3390;
  await app.listen(port);
  console.log(`business-orchestrator listening on :${port}`);
}
```

Add the missing imports at the top of `src/main.ts`:

```typescript
import { ContractViolationFilter } from './common/filters/contract-violation.filter';
import { NotificationsClient } from './common/notifications/notifications.client';
```

- [ ] **Step 3: Build to confirm no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors)

- [ ] **Step 4: Commit**

```bash
git add src/common/filters/contract-violation.filter.ts src/main.ts
git commit -m "feat(contracts): add global ContractViolationFilter with critical notification"
```

---

## Task 3: New AI contract schemas + update index

**Files:**
- Create: `src/contracts/coordinator.contract.ts`
- Create: `src/contracts/goal-review.contract.ts`
- Create: `src/contracts/coding-worker.contract.ts`
- Modify: `src/contracts/index.ts`

- [ ] **Step 1: Write failing tests for new schemas in contracts.spec.ts**

Add to `src/contracts/contracts.spec.ts` (append after existing describes):

```typescript
import {
  GlobalCoordinatorResponseSchema,
  CcReviewResponseSchema,
  CodingPlanSchema,
} from './index';

describe('GlobalCoordinatorResponseSchema', () => {
  it('accepts valid response', () => {
    const r = GlobalCoordinatorResponseSchema.safeParse({
      projects_to_run: ['proj-1', 'proj-2'],
      decisions: ['proj-1 is stalled'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects more than 5 projects', () => {
    const r = GlobalCoordinatorResponseSchema.safeParse({
      projects_to_run: ['a', 'b', 'c', 'd', 'e', 'f'],
      decisions: [],
    });
    expect(r.success).toBe(false);
  });

  it('accepts empty arrays', () => {
    const r = GlobalCoordinatorResponseSchema.safeParse({
      projects_to_run: [],
      decisions: [],
    });
    expect(r.success).toBe(true);
  });
});

describe('CcReviewResponseSchema', () => {
  const valid = {
    verdict: 'ok',
    summary: 'looks good',
    cc_approach: 'no changes',
    findings: [],
    proposed_changes: [],
  };

  it('accepts valid ok verdict', () => {
    expect(CcReviewResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown verdict', () => {
    const r = CcReviewResponseSchema.safeParse({ ...valid, verdict: 'maybe' });
    expect(r.success).toBe(false);
  });

  it('defaults empty arrays when omitted', () => {
    const r = CcReviewResponseSchema.safeParse({
      verdict: 'ok',
      summary: 's',
      cc_approach: 'c',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.findings).toEqual([]);
      expect(r.data.proposed_changes).toEqual([]);
    }
  });

  it('rejects finding with invalid severity', () => {
    const r = CcReviewResponseSchema.safeParse({
      ...valid,
      findings: [{ severity: 'fatal', area: 'a', description: 'd', evidence: 'e' }],
    });
    expect(r.success).toBe(false);
  });

  it('passes through extra fields (passthrough)', () => {
    const r = CcReviewResponseSchema.safeParse({ ...valid, extra_field: 'x' });
    expect(r.success).toBe(true);
  });
});

describe('CodingPlanSchema', () => {
  const validStep = {
    id: 'step1',
    depends_on: [],
    file: 'src/foo/bar.ts',
    description: 'add method',
    action: 'modify',
  };

  it('accepts a valid plan', () => {
    const r = CodingPlanSchema.safeParse({ steps: [validStep] });
    expect(r.success).toBe(true);
  });

  it('rejects empty steps array', () => {
    const r = CodingPlanSchema.safeParse({ steps: [] });
    expect(r.success).toBe(false);
  });

  it('rejects step with empty id', () => {
    const r = CodingPlanSchema.safeParse({ steps: [{ ...validStep, id: '' }] });
    expect(r.success).toBe(false);
  });

  it('rejects step with invalid action', () => {
    const r = CodingPlanSchema.safeParse({ steps: [{ ...validStep, action: 'rename' }] });
    expect(r.success).toBe(false);
  });

  it('accepts optional status field', () => {
    const r = CodingPlanSchema.safeParse({ steps: [{ ...validStep, status: 'done' }] });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: errors about missing exports from `./index`

- [ ] **Step 3: Create coordinator.contract.ts**

```typescript
// src/contracts/coordinator.contract.ts
import { z } from 'zod';

export const GlobalCoordinatorResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  projects_to_run: z.array(z.string()).max(5),
  decisions: z.array(z.string()),
}).passthrough();

export type GlobalCoordinatorResponse = z.infer<typeof GlobalCoordinatorResponseSchema>;
```

- [ ] **Step 4: Create goal-review.contract.ts**

```typescript
// src/contracts/goal-review.contract.ts
import { z } from 'zod';

export const CcFindingSchema = z.object({
  severity: z.enum(['low', 'medium', 'high']),
  area: z.string(),
  description: z.string(),
  evidence: z.string(),
});

export const CcProposedChangeSchema = z.object({
  file: z.string(),
  description: z.string(),
  diff_hint: z.string(),
});

export const CcReviewResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  verdict: z.enum(['ok', 'needs_improvement']),
  summary: z.string(),
  cc_approach: z.string(),
  findings: z.array(CcFindingSchema).default([]),
  proposed_changes: z.array(CcProposedChangeSchema).default([]),
  pr_title: z.string().default(''),
  pr_body: z.string().default(''),
  wiki_entry: z.string().default(''),
}).passthrough();

export type CcFinding = z.infer<typeof CcFindingSchema>;
export type CcProposedChange = z.infer<typeof CcProposedChangeSchema>;
export type CcReviewResponse = z.infer<typeof CcReviewResponseSchema>;
```

- [ ] **Step 5: Create coding-worker.contract.ts**

```typescript
// src/contracts/coding-worker.contract.ts
import { z } from 'zod';

export const CodingStepSchema = z.object({
  id: z.string().min(1),
  depends_on: z.array(z.string()),
  file: z.string().min(1),
  description: z.string().min(1),
  action: z.enum(['create', 'modify', 'delete']),
  status: z.enum(['pending', 'done', 'failed']).optional(),
});

export const CodingPlanSchema = z.object({
  steps: z.array(CodingStepSchema).min(1),
});

export type CodingStep = z.infer<typeof CodingStepSchema>;
export type CodingPlan = z.infer<typeof CodingPlanSchema>;
```

- [ ] **Step 6: Update src/contracts/index.ts to re-export new schemas**

Read current `src/contracts/index.ts` (it exports 6 items), then replace entirely:

```typescript
// src/contracts/index.ts
export * from './task-payload.contract';
export * from './agent-result.contract';
export * from './validation-request.contract';
export * from './validation-result.contract';
export * from './ai-complete.contract';
export * from './cc-planner-output.contract';
export * from './contract-violation.error';
export * from './parse-or-throw';
export * from './coordinator.contract';
export * from './goal-review.contract';
export * from './coding-worker.contract';
export * from './http-responses.contract';
```

Note: `http-responses.contract.ts` will be created in Task 4 — the build won't succeed until then. That's fine; tests in this task only require the first 11 exports.

- [ ] **Step 7: Run schema tests to confirm they pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | tail -15
```

Expected: all existing tests still pass + new tests for GlobalCoordinatorResponseSchema, CcReviewResponseSchema, CodingPlanSchema pass.

- [ ] **Step 8: Commit**

```bash
git add src/contracts/coordinator.contract.ts src/contracts/goal-review.contract.ts src/contracts/coding-worker.contract.ts src/contracts/index.ts src/contracts/contracts.spec.ts
git commit -m "feat(contracts): add coordinator, goal-review, and coding-worker AI response schemas"
```

---

## Task 4: HTTP response schemas

**Files:**
- Create: `src/contracts/http-responses.contract.ts`

- [ ] **Step 1: Write failing tests for HTTP schemas in contracts.spec.ts**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import {
  TaskResponseSchema,
  TaskListItemSchema,
  ExecutionResponseSchema,
  ProjectCardSchema,
  DashboardOverviewSchema,
  GoalResponseSchema,
  ProjectResponseSchema,
  AgentResponseSchema,
  EscalationResponseSchema,
  SuccessRateSchema,
  GoalVelocitySchema,
  LlmCostSchema,
  HealthResponseSchema,
  DigestTriggerResponseSchema,
  DashboardBulkDeleteResponseSchema,
  DashboardApproveResponseSchema,
  DashboardAgentCountsSchema,
  DashboardTaskDetailSchema,
} from './http-responses.contract';

describe('HealthResponseSchema', () => {
  it('accepts valid health response', () => {
    const r = HealthResponseSchema.safeParse({ status: 'ok', service: 'business-orchestrator', ts: new Date().toISOString() });
    expect(r.success).toBe(true);
  });
  it('rejects missing status', () => {
    expect(HealthResponseSchema.safeParse({ service: 'x', ts: 'now' }).success).toBe(false);
  });
});

describe('TaskResponseSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    project_id: '123e4567-e89b-12d3-a456-426614174001',
    goal_id: '123e4567-e89b-12d3-a456-426614174002',
    parent_task_id: null,
    type: 'coding',
    status: 'created',
    priority: 2,
    attempt: 1,
    max_attempts: 3,
    acceptance_criteria: ['does the thing'],
    payload_ref: {},
    output_ref: null,
    blocked_reason: null,
    spec_section_anchor: null,
    plan_reference: null,
    batch_id: null,
    batch_context_ref: null,
    created_at: new Date().toISOString(),
    assigned_at: null,
    completed_at: null,
  };
  it('accepts valid task', () => {
    expect(TaskResponseSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    expect(TaskResponseSchema.safeParse(rest).success).toBe(false);
  });
});

describe('GoalResponseSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    projectId: '123e4567-e89b-12d3-a456-426614174001',
    title: 'Build feature X',
    description: null,
    status: 'queued',
    priority: 3,
    completionPct: 0,
    constraints: [],
    proposedPlan: null,
    createdBy: 'human',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    blockedReason: null,
    specReference: null,
    planReference: null,
  };
  it('accepts valid goal', () => {
    expect(GoalResponseSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects invalid status', () => {
    expect(GoalResponseSchema.safeParse({ ...valid, status: 'unknown' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | grep "FAIL\|Cannot find\|SyntaxError" | head -10
```

Expected: import errors for `http-responses.contract`

- [ ] **Step 3: Create http-responses.contract.ts**

```typescript
// src/contracts/http-responses.contract.ts
import { z } from 'zod';

// ---- Primitives ----

const NullableString = z.string().nullable();
const NullableDate = z.union([z.string(), z.date()]).nullable();
const NullableNumber = z.number().nullable();

// ---- Health ----

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  ts: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ---- Digest ----

export const DigestTriggerResponseSchema = z.object({
  sent: z.boolean(),
  timestamp: z.string(),
});
export type DigestTriggerResponse = z.infer<typeof DigestTriggerResponseSchema>;

// ---- Tasks ----

export const ExecutionSummarySchema = z.object({
  id: z.string(),
  phase: z.string(),
  attempt_number: z.number(),
  agent_id: NullableString,
  model_used: NullableString,
  model_tier: NullableString,
  outcome: NullableString,
  error_code: NullableString,
  token_usage_estimate: z.number(),
  duration_ms: NullableNumber,
  started_at: z.union([z.string(), z.date()]),
  ended_at: NullableDate,
  output_ref: z.record(z.string(), z.unknown()).nullable(),
});

export const TaskResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  goal_id: NullableString,
  parent_task_id: NullableString,
  type: z.string(),
  status: z.string(),
  priority: z.number(),
  attempt: z.number(),
  max_attempts: z.number(),
  acceptance_criteria: z.array(z.string()),
  payload_ref: z.record(z.string(), z.unknown()),
  output_ref: z.record(z.string(), z.unknown()).nullable(),
  blocked_reason: NullableString,
  spec_section_anchor: NullableString,
  plan_reference: NullableString,
  batch_id: NullableString,
  batch_context_ref: NullableString,
  created_at: NullableDate,
  assigned_at: NullableDate,
  completed_at: NullableDate,
  executions: z.array(ExecutionSummarySchema).optional(),
});
export type TaskResponse = z.infer<typeof TaskResponseSchema>;

export const TaskListItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectSlug: z.string(),
  businessSlug: z.string(),
  goalId: NullableString,
  type: z.string(),
  status: z.string(),
  priority: z.number(),
  attempt: z.number(),
  maxAttempts: z.number(),
  blockedBy: z.array(z.string()),
  predecessor: z.array(z.string()),
  successor: z.array(z.string()),
  createdAt: NullableDate,
});
export type TaskListItem = z.infer<typeof TaskListItemSchema>;

export const DashboardTaskDetailSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  status: z.string(),
  priority: z.number(),
  attempt: z.number(),
  maxAttempts: z.number(),
  payloadRef: z.record(z.string(), z.unknown()),
  acceptanceCriteria: z.array(z.string()),
  blockedBy: z.array(z.string()).nullable(),
  predecessor: z.array(z.string()).nullable(),
  pendingQuestion: NullableString,
  aiRequestLog: z.unknown().nullable(),
  aiResponseLog: z.unknown().nullable(),
  createdAt: NullableDate,
  assignedAt: NullableDate,
  completedAt: NullableDate,
});
export type DashboardTaskDetail = z.infer<typeof DashboardTaskDetailSchema>;

export const DashboardApproveResponseSchema = z.object({
  ok: z.boolean(),
  task: DashboardTaskDetailSchema,
});
export type DashboardApproveResponse = z.infer<typeof DashboardApproveResponseSchema>;

export const DashboardBulkDeleteResponseSchema = z.object({
  deletedTasks: z.number(),
  deletedExecutions: z.number(),
});
export type DashboardBulkDeleteResponse = z.infer<typeof DashboardBulkDeleteResponseSchema>;

// ---- Executions ----

export const ExecutionResponseSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  phase: z.string(),
  attemptNumber: z.number(),
  outcome: z.string(),
  errorCode: NullableString,
  modelUsed: NullableString,
  modelTier: NullableString,
  startedAt: z.union([z.string(), z.date()]),
  endedAt: NullableDate,
  durationMs: NullableNumber,
});
export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

// ---- Goals ----

const ProposedPlanItemSchema = z.object({
  type: z.string(),
  description: z.string(),
  acceptance_criteria: z.array(z.string()),
  priority: z.number(),
  payload_ref: z.record(z.string(), z.unknown()),
  target_service: z.string().optional(),
  smoke_test_urls: z.array(z.string()).optional(),
});

export const GoalResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: NullableString,
  status: z.enum(['queued', 'planning', 'approved', 'active', 'completed', 'cancelled']),
  priority: z.number(),
  completionPct: z.number(),
  constraints: z.array(z.string()),
  proposedPlan: z.array(ProposedPlanItemSchema).nullable(),
  createdBy: z.enum(['human', 'system']),
  createdAt: NullableDate,
  updatedAt: NullableDate,
  completedAt: NullableDate,
  blockedReason: NullableString,
  specReference: NullableString,
  planReference: NullableString,
});
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

// ---- Projects ----

export const ProjectResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  repoRef: NullableString,
  stage: z.enum(['discovery', 'mvp', 'growth', 'mature', 'sunset']),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
  coordinatorAgentId: NullableString,
  stateSnapshot: z.record(z.string(), z.unknown()),
  stateVersion: z.number(),
  lastCycleAt: NullableDate,
  quota: z.object({
    max_concurrent_tasks: z.number(),
    daily_llm_units: z.number(),
  }),
  executionMode: z.enum(['manual', 'auto']),
  createdAt: NullableDate,
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

// ---- Dashboard ----

const ActiveGoalSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  completionPct: z.number(),
  status: z.string(),
  blockedReason: NullableString,
  proposedPlan: z.array(ProposedPlanItemSchema).nullable(),
}).nullable();

export const ProjectCardSchema = z.object({
  projectId: z.string(),
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  repoRef: NullableString,
  status: z.string(),
  stage: z.string(),
  health: z.string(),
  tasksActive: z.number(),
  lastCycleAt: NullableDate,
  nextFocus: z.string(),
  quota: z.object({
    max_concurrent_tasks: z.number(),
    daily_llm_units: z.number(),
  }),
  executionMode: z.string(),
  activeGoal: ActiveGoalSummarySchema,
});
export type ProjectCard = z.infer<typeof ProjectCardSchema>;

export const DashboardOverviewSchema = z.object({
  projects: z.array(ProjectCardSchema),
  agents: z.object({
    total: z.number(),
    idle: z.number(),
    busy: z.number(),
    disabled: z.number(),
  }),
});
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

export const DashboardAgentCountsSchema = z.object({
  workers: z.object({
    total: z.number(),
    idle: z.number(),
    busy: z.number(),
    disabled: z.number(),
  }),
  allWorkersDisabled: z.boolean(),
  noIdleWorkers: z.boolean(),
});
export type DashboardAgentCounts = z.infer<typeof DashboardAgentCountsSchema>;

// ---- Agents ----

export const AgentResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  modelTier: z.string(),
  status: z.enum(['idle', 'busy', 'stale', 'disabled']),
  currentTaskId: NullableString,
  currentTaskType: NullableString,
  currentTaskStatus: NullableString,
  goalId: NullableString,
  goalTitle: NullableString,
  projectId: NullableString,
  projectSlug: NullableString,
  heartbeatAgeSeconds: NullableNumber,
  lastHeartbeatAt: NullableDate,
  failureCount: z.number(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ---- Escalations ----

export const EscalationResponseSchema = z.object({
  id: z.string(),
  businessId: NullableString,
  projectId: NullableString,
  taskId: NullableString,
  level: z.enum(['warn', 'critical']),
  subject: z.string(),
  body: z.string(),
  status: z.enum(['open', 'acknowledged', 'resolved']),
  createdAt: NullableDate,
  acknowledgedAt: NullableDate,
  resolvedAt: NullableDate,
  resolverNote: NullableString,
});
export type EscalationResponse = z.infer<typeof EscalationResponseSchema>;

// ---- Metrics ----

export const SuccessRateSchema = z.object({
  successRate: z.number(),
  total: z.number(),
  done: z.number(),
  failed: z.number(),
});
export type SuccessRate = z.infer<typeof SuccessRateSchema>;

export const GoalVelocitySchema = z.object({
  monthlyVelocity: z.array(z.object({ month: z.string(), completed: z.number() })),
  avgDaysToComplete: z.number(),
});
export type GoalVelocity = z.infer<typeof GoalVelocitySchema>;

export const LlmCostSchema = z.object({
  total: z.number(),
  byTier: z.array(z.object({
    tier: z.string(),
    tokens: z.number(),
    executions: z.number(),
  })),
});
export type LlmCost = z.infer<typeof LlmCostSchema>;
```

- [ ] **Step 4: Run schema tests to confirm they pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | tail -15
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/contracts/http-responses.contract.ts src/contracts/contracts.spec.ts
git commit -m "feat(contracts): add HTTP response schemas for all controllers"
```

---

## Task 5: Wire AI contract — GlobalCoordinatorService

**Files:**
- Modify: `src/coordinator/global-coordinator.service.ts`

- [ ] **Step 1: Add parseOrThrow import and wrap AI output**

In `src/coordinator/global-coordinator.service.ts`, find the import block at the top and add:

```typescript
import { parseOrThrow, GlobalCoordinatorResponseSchema } from '../contracts';
```

Then find the section after `extractStructuredOutput` (around line 140):

```typescript
const aiData = extractStructuredOutput(response.data as Record<string, unknown>);
projectsToRun = (aiData['projects_to_run'] ?? []) as string[];
decisions = (aiData['decisions'] ?? []) as string[];
```

Replace with:

```typescript
const aiData = extractStructuredOutput(response.data as Record<string, unknown>);
const validated = parseOrThrow(
  GlobalCoordinatorResponseSchema,
  aiData,
  'global_coordinator.tick',
);
projectsToRun = validated.projects_to_run;
decisions = validated.decisions;
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/coordinator/global-coordinator.service.ts
git commit -m "feat(contracts): enforce GlobalCoordinatorResponse schema at AI boundary"
```

---

## Task 6: Wire AI contract — ProjectCoordinatorService

**Files:**
- Modify: `src/coordinator/project-coordinator.service.ts`

- [ ] **Step 1: Add import**

Add to imports in `src/coordinator/project-coordinator.service.ts`:

```typescript
import { parseOrThrow, CcPlannerOutputSchema } from '../contracts';
```

- [ ] **Step 2: Replace alias fallbacks + normalizeCoordinatorTaskSpec with schema validation**

Find the block starting around line 295 (after `extractStructuredOutput` / `parseCoordinatorJsonFromAiText`):

```typescript
let new_tasks_raw = (raw.new_tasks ?? raw.newTasks ?? []) as any[];
const state_patch_raw = (raw.state_patch ?? raw.statePatch ?? {}) as Record<string, unknown>;
// Recovery: if LLM put task data in state_patch instead of new_tasks, promote it
if (new_tasks_raw.length === 0 && typeof state_patch_raw.type === 'string') {
  new_tasks_raw = [state_patch_raw];
}
const state_patch: Record<string, unknown> = new_tasks_raw.length === 1 && state_patch_raw === new_tasks_raw[0]
  ? {}
  : state_patch_raw;
const decisions = (raw.decisions ?? []) as string[];
```

Replace with:

```typescript
// Normalize aliases before contract validation
const normalized = {
  new_tasks: raw['new_tasks'] ?? raw['newTasks'] ?? [],
  state_patch: raw['state_patch'] ?? raw['statePatch'] ?? {},
  decisions: raw['decisions'] ?? [],
};

const validated = parseOrThrow(CcPlannerOutputSchema, normalized, 'coordinator.cycle');
const new_tasks_raw = validated.new_tasks;
const state_patch = validated.state_patch;
const decisions = validated.decisions;
```

Then find and **delete** the `normalizeCoordinatorTaskSpec` private method (it is no longer needed — the schema validates the shape). Also delete any call sites referencing `normalizeCoordinatorTaskSpec`.

- [ ] **Step 3: Update downstream code that used normalizedTasks**

After the replacement above, find:

```typescript
const normalizedTasks = new_tasks_raw
  .map((s) => this.normalizeCoordinatorTaskSpec(s))
  .filter((s): s is NonNullable<typeof s> => s !== null);
```

Replace with:

```typescript
const normalizedTasks = new_tasks_raw;
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If there are errors referencing `normalizeCoordinatorTaskSpec`, find and remove the remaining call sites.

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/project-coordinator.service.ts
git commit -m "feat(contracts): enforce CcPlannerOutputSchema in ProjectCoordinatorService, remove alias fallbacks"
```

---

## Task 7: Wire AI contract — GoalReviewService

**Files:**
- Modify: `src/goal-review/goal-review.service.ts`

- [ ] **Step 1: Replace local interfaces and manual mapping with Zod schema**

In `src/goal-review/goal-review.service.ts`, find the local interface block:

```typescript
interface CcFinding {
  ...
}

interface CcProposedChange {
  ...
}

interface CcReviewResponse {
  ...
}
```

Delete all three local interfaces and add this import:

```typescript
import { parseOrThrow, CcReviewResponseSchema, CcReviewResponse } from '../contracts';
```

- [ ] **Step 2: Replace manual mapping with parseOrThrow**

Find the manual mapping block (around line 114):

```typescript
const review: CcReviewResponse = {
  verdict: (response['verdict'] === 'needs_improvement' ? 'needs_improvement' : 'ok') as CcReviewResponse['verdict'],
  summary: String(response['summary'] ?? ''),
  cc_approach: String(response['cc_approach'] ?? ''),
  findings: Array.isArray(response['findings']) ? response['findings'] as CcFinding[] : [],
  proposed_changes: Array.isArray(response['proposed_changes']) ? response['proposed_changes'] as CcProposedChange[] : [],
  pr_title: String(response['pr_title'] ?? ''),
  pr_body: String(response['pr_body'] ?? ''),
  wiki_entry: String(response['wiki_entry'] ?? ''),
};
```

Replace with:

```typescript
const review = parseOrThrow(CcReviewResponseSchema, response, 'goal_review.review');
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If `CcFinding` or `CcProposedChange` are referenced elsewhere in the file, update those references to use the imported types from `'../contracts'`.

- [ ] **Step 4: Commit**

```bash
git add src/goal-review/goal-review.service.ts
git commit -m "feat(contracts): enforce CcReviewResponseSchema in GoalReviewService, remove manual casting"
```

---

## Task 8: Wire AI contract — CodingWorkerAgentService

**Files:**
- Modify: `src/coding-worker/coding-plan.types.ts`
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

- [ ] **Step 1: Replace interfaces in coding-plan.types.ts with Zod-inferred types**

Read `src/coding-worker/coding-plan.types.ts`. Replace the two interfaces and keep `validateCodingPlan`:

```typescript
// src/coding-worker/coding-plan.types.ts
export { CodingStep, CodingPlan } from '../contracts/coding-worker.contract';
import { CodingPlan } from '../contracts/coding-worker.contract';

export function validateCodingPlan(plan: CodingPlan): import('../contracts/coding-worker.contract').CodingStep[] {
  if (!plan.steps || plan.steps.length === 0) throw new Error('at least one step required');
  const inDegree: Record<string, number> = {};
  const graph: Record<string, string[]> = {};
  for (const s of plan.steps) { inDegree[s.id] = 0; graph[s.id] = []; }
  for (const s of plan.steps) {
    for (const dep of s.depends_on) {
      if (!graph[dep]) throw new Error(`unknown dependency: ${dep}`);
      graph[dep].push(s.id);
      inDegree[s.id]++;
    }
  }
  const queue = plan.steps.filter(s => inDegree[s.id] === 0).map(s => s.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of graph[id]) { if (--inDegree[next] === 0) queue.push(next); }
  }
  if (order.length !== plan.steps.length) throw new Error('cyclic dependency detected in coding plan');
  return order.map(id => plan.steps.find(s => s.id === id)!);
}
```

- [ ] **Step 2: Add parseOrThrow + CodingPlanSchema in coding-worker-agent.service.ts**

Add to imports in `src/coding-worker/coding-worker-agent.service.ts`:

```typescript
import { parseOrThrow, CodingPlanSchema } from '../contracts';
```

Find the `buildCodingPlan` method, specifically the final return line (around line 306):

```typescript
return validateCodingPlan(response as unknown as CodingPlan);
```

Replace with:

```typescript
const plan = parseOrThrow(CodingPlanSchema, response, 'coding_worker.build_plan');
return validateCodingPlan(plan);
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/coding-worker/coding-plan.types.ts src/coding-worker/coding-worker-agent.service.ts
git commit -m "feat(contracts): enforce CodingPlanSchema in CodingWorkerAgentService before DAG validation"
```

---

## Task 9: Wire HTTP response contracts — TasksController

**Files:**
- Modify: `src/tasks/tasks.controller.ts`

- [ ] **Step 1: Add imports and wrap responses**

Add to imports in `src/tasks/tasks.controller.ts`:

```typescript
import { parseOrThrow, TaskResponseSchema, TaskListItemSchema } from '../contracts';
```

Find `findAll`:

```typescript
async findAll(@Param('projectId') projectId: string, @Query('status') status?: string) {
  const tasks = await this.service.findByProject(projectId, status);
  return tasks.map((t) => ({ ...t, goal_id: t.goalId }));
}
```

Replace with:

```typescript
async findAll(@Param('projectId') projectId: string, @Query('status') status?: string) {
  const tasks = await this.service.findByProject(projectId, status);
  return tasks.map((t) => parseOrThrow(TaskListItemSchema, {
    id: t.id,
    projectId: t.projectId,
    projectSlug: '',
    businessSlug: '',
    goalId: t.goalId ?? null,
    type: t.type,
    status: t.status,
    priority: t.priority,
    attempt: t.attempt,
    maxAttempts: t.maxAttempts,
    blockedBy: (t as any).blockedBy ?? [],
    predecessor: (t as any).predecessor ?? [],
    successor: (t as any).successor ?? [],
    createdAt: t.createdAt ?? null,
  }, 'tasks.findAll'));
}
```

Find `findOne` — after building `base`, wrap before return:

```typescript
// at end of findOne, before `if (include === 'executions')`:
// change: return base;  and  return { ...base, executions: ... }
// to use parseOrThrow

// Replace both return statements:
if (include === 'executions') {
  const execList = await this.executions.findByTask(taskId);
  return parseOrThrow(TaskResponseSchema, {
    ...base,
    executions: execList.map((e) => ({
      id: e.id,
      phase: e.phase,
      attempt_number: e.attemptNumber,
      agent_id: e.agentId ?? null,
      model_used: e.modelUsed ?? null,
      model_tier: e.modelTier ?? null,
      outcome: e.outcome ?? null,
      error_code: e.errorCode ?? null,
      token_usage_estimate: e.tokenUsageEstimate,
      duration_ms: e.durationMs ?? null,
      started_at: e.startedAt,
      ended_at: e.endedAt ?? null,
      output_ref: e.outputRef ?? null,
    })),
  }, 'tasks.findOne');
}
return parseOrThrow(TaskResponseSchema, base, 'tasks.findOne');
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/tasks/tasks.controller.ts
git commit -m "feat(contracts): enforce TaskResponseSchema and TaskListItemSchema in TasksController"
```

---

## Task 10: Wire HTTP response contracts — GoalsController + ProjectsController

**Files:**
- Modify: `src/goals/goals.controller.ts`
- Modify: `src/projects/projects.controller.ts`

- [ ] **Step 1: Add contract to GoalsController**

Add import to `src/goals/goals.controller.ts`:

```typescript
import { parseOrThrow, GoalResponseSchema } from '../contracts';
```

Wrap the `deleteGoal` response (it already returns `{ ok: true }` — a simple inline object, no schema needed there). For all methods returning a goal entity, add `parseOrThrow(GoalResponseSchema, goal, 'goals.<method>')`. Specifically:

- `createGoal`: `return parseOrThrow(GoalResponseSchema, await this.goalsService.create(projectId, dto), 'goals.create');`
- `updateGoal`: `return parseOrThrow(GoalResponseSchema, await this.goalsService.update(goalId, dto), 'goals.update');`
- `startPlanning`: already returns `goal` — wrap: `return parseOrThrow(GoalResponseSchema, goal, 'goals.startPlanning');`
- `approvePlan`: `return parseOrThrow(GoalResponseSchema, await this.goalsService.approve(goalId), 'goals.approve');`
- `cancelGoal`: `return parseOrThrow(GoalResponseSchema, await this.goalsService.cancel(goalId, dto.reason), 'goals.cancel');`

- [ ] **Step 2: Add contract to ProjectsController**

Add import to `src/projects/projects.controller.ts`:

```typescript
import { parseOrThrow, ProjectResponseSchema } from '../contracts';
```

Wrap all methods returning a project entity:

- `create`: `return parseOrThrow(ProjectResponseSchema, await this.service.create(dto), 'projects.create');`
- `findAll`: `return (await this.service.findAll()).map(p => parseOrThrow(ProjectResponseSchema, p, 'projects.findAll'));`
- `findOne`: `return parseOrThrow(ProjectResponseSchema, await this.service.findOne(projectId), 'projects.findOne');`
- `update`: `return parseOrThrow(ProjectResponseSchema, await this.service.update(projectId, dto), 'projects.update');`
- `offboard`: service returns project — wrap result
- `unregister`: service returns project — wrap result

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If the `offboard`/`unregister` service methods return something other than a `Project`, check the return type and adjust the schema call to match (or create an `OffboardResponseSchema` if the shape differs).

- [ ] **Step 4: Commit**

```bash
git add src/goals/goals.controller.ts src/projects/projects.controller.ts
git commit -m "feat(contracts): enforce GoalResponseSchema and ProjectResponseSchema in controllers"
```

---

## Task 11: Wire HTTP response contracts — ExecutionsController + AgentsController + EscalationsController

**Files:**
- Modify: `src/executions/executions.controller.ts`
- Modify: `src/agents/agents.controller.ts`
- Modify: `src/escalations/escalations.controller.ts`

- [ ] **Step 1: ExecutionsController**

Add import to `src/executions/executions.controller.ts`:

```typescript
import { parseOrThrow, ExecutionResponseSchema } from '../contracts';
```

Wrap each mapped execution in `findByTask`:

```typescript
return executions
  .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  .slice(0, 50)
  .map((execution) => parseOrThrow(ExecutionResponseSchema, {
    id: execution.id,
    taskId: execution.taskId,
    phase: execution.phase,
    attemptNumber: execution.attemptNumber,
    outcome: execution.outcome ?? 'pending',
    errorCode: execution.errorCode ?? null,
    modelUsed: execution.modelUsed ?? null,
    modelTier: execution.modelTier ?? null,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt ?? null,
    durationMs: execution.durationMs ?? null,
  }, 'executions.findByTask'));
```

- [ ] **Step 2: AgentsController**

Add import to `src/agents/agents.controller.ts`:

```typescript
import { parseOrThrow, AgentResponseSchema } from '../contracts';
```

Wrap `findAll` response:

```typescript
async findAll(): Promise<AgentResponse[]> {
  const agents = await this.agentsService.findAllWithStatus();
  return agents.map(a => parseOrThrow(AgentResponseSchema, a, 'agents.findAll'));
}
```

Also add return type import: `import { AgentResponse } from '../contracts';`

For `disable` and `enable` — they return a raw entity from `agentsService`. Check the return type of `agentsService.disable()`. If it returns a full `Agent` entity, wrap with `AgentResponseSchema`. If it returns `void` or a simple ack, create a minimal inline schema. For now wrap with `AgentResponseSchema` and adjust if build fails.

- [ ] **Step 3: EscalationsController**

Add import to `src/escalations/escalations.controller.ts`:

```typescript
import { parseOrThrow, EscalationResponseSchema } from '../contracts';
```

The `list` and `findOne` methods return raw entities from the service. Wrap each:

```typescript
@Get()
async list(@Query('project_id') projectId?: string, @Query('status') status?: string) {
  const items = await this.escalationsService.findAll({ projectId, status });
  return (items as any[]).map(e => parseOrThrow(EscalationResponseSchema, e, 'escalations.list'));
}

@Get(':id')
async findOne(@Param('id') id: string) {
  return parseOrThrow(EscalationResponseSchema, await this.escalationsService.findOne(id), 'escalations.findOne');
}

@Post(':id/acknowledge')
async acknowledge(@Param('id') id: string) {
  return parseOrThrow(EscalationResponseSchema, await this.escalationsService.acknowledge(id), 'escalations.acknowledge');
}

@Post(':id/resolve')
async resolve(@Param('id') id: string, @Body('note') note?: string) {
  return parseOrThrow(EscalationResponseSchema, await this.escalationsService.resolve(id, note), 'escalations.resolve');
}
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If `agentsService.disable()` returns a type incompatible with `AgentResponseSchema`, create a minimal `AgentAckResponseSchema = z.object({ id: z.string(), status: z.string() })` and use that instead.

- [ ] **Step 5: Commit**

```bash
git add src/executions/executions.controller.ts src/agents/agents.controller.ts src/escalations/escalations.controller.ts
git commit -m "feat(contracts): enforce response schemas in Executions, Agents, and Escalations controllers"
```

---

## Task 12: Wire HTTP response contracts — MetricsController + HealthController + DigestController

**Files:**
- Modify: `src/metrics/metrics.controller.ts`
- Modify: `src/health.controller.ts`
- Modify: `src/digest/digest.controller.ts`

- [ ] **Step 1: MetricsController**

Add import to `src/metrics/metrics.controller.ts`:

```typescript
import { parseOrThrow, SuccessRateSchema, GoalVelocitySchema, LlmCostSchema } from '../contracts';
```

Note: `getPrometheus()` returns plain text (`text/plain`), not JSON — **skip contract validation for that endpoint only** (it's a Prometheus scrape endpoint, not a JSON API).

Wrap JSON endpoints:

```typescript
@Get('success-rate')
@UseGuards(JwtGuard)
async getSuccessRate(@Query('projectId') projectId?: string) {
  return parseOrThrow(SuccessRateSchema, await this.metricsService.getSuccessRate(projectId), 'metrics.successRate');
}

@Get('goal-velocity')
@UseGuards(JwtGuard)
async getGoalVelocity(@Query('projectId') projectId?: string) {
  return parseOrThrow(GoalVelocitySchema, await this.metricsService.getGoalVelocity(projectId), 'metrics.goalVelocity');
}

@Get('llm-cost')
@UseGuards(JwtGuard)
async getLlmCost(@Query('projectId') projectId?: string, @Query('month') month?: string) {
  return parseOrThrow(LlmCostSchema, await this.metricsService.getLlmCost(projectId, month), 'metrics.llmCost');
}
```

- [ ] **Step 2: HealthController**

Add import to `src/health.controller.ts`:

```typescript
import { parseOrThrow, HealthResponseSchema } from './contracts';
```

Wrap response:

```typescript
@Get('health')
health() {
  return parseOrThrow(HealthResponseSchema, {
    status: 'ok',
    service: 'business-orchestrator',
    ts: new Date().toISOString(),
  }, 'health.check');
}
```

- [ ] **Step 3: DigestController**

Add import to `src/digest/digest.controller.ts`:

```typescript
import { parseOrThrow, DigestTriggerResponseSchema } from '../contracts';
```

Wrap response:

```typescript
@Post('trigger')
@UseGuards(JwtGuard)
async trigger() {
  await this.digestService.sendMorningDigest();
  return parseOrThrow(DigestTriggerResponseSchema, {
    sent: true,
    timestamp: new Date().toISOString(),
  }, 'digest.trigger');
}
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/metrics/metrics.controller.ts src/health.controller.ts src/digest/digest.controller.ts
git commit -m "feat(contracts): enforce response schemas in Metrics, Health, and Digest controllers"
```

---

## Task 13: Wire HTTP response contracts — DashboardController

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Add imports**

```typescript
import {
  parseOrThrow,
  DashboardOverviewSchema,
  DashboardTaskDetailSchema,
  DashboardApproveResponseSchema,
  DashboardBulkDeleteResponseSchema,
  DashboardAgentCountsSchema,
  TaskListItemSchema,
  GoalResponseSchema,
} from '../contracts';
```

- [ ] **Step 2: Wrap overview endpoint**

Find `overview()` method. It builds `projectCards` array then returns `{ projects: projectCards, agents: { ... } }`. Replace the final return:

```typescript
return parseOrThrow(DashboardOverviewSchema, {
  projects: projectCards,
  agents: {
    total: agents.length,
    idle: agents.filter((a) => a.status === 'idle').length,
    busy: agents.filter((a) => a.status === 'busy').length,
    disabled: agents.filter((a) => a.status === 'disabled').length,
  },
}, 'dashboard.overview');
```

- [ ] **Step 3: Wrap task-related endpoints**

`taskDetail` — wrap `toTaskDetail(task)` result:

```typescript
async taskDetail(@Param('taskId') taskId: string) {
  const task = await this.tasksService.findOne(taskId);
  return parseOrThrow(DashboardTaskDetailSchema, this.toTaskDetail(task), 'dashboard.taskDetail');
}
```

`approveTask`:
```typescript
return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.approveTask');
```

`rejectTask`:
```typescript
return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.rejectTask');
```

`answerTask`:
```typescript
return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.answerTask');
```

`bulkDeleteTasks`:
```typescript
return parseOrThrow(DashboardBulkDeleteResponseSchema, { deletedTasks, deletedExecutions }, 'dashboard.bulkDelete');
```

`agentHealth`:
```typescript
return parseOrThrow(DashboardAgentCountsSchema, {
  ...counts,
  allWorkersDisabled: counts.workers.total > 0 && counts.workers.disabled === counts.workers.total,
  noIdleWorkers: counts.workers.idle === 0,
}, 'dashboard.agentHealth');
```

`allGoals` — returns an array. Wrap each row:
```typescript
return rows.map(g => parseOrThrow(GoalResponseSchema, g, 'dashboard.allGoals'));
```

`allTasks` — returns an array. Wrap each row:
```typescript
return rows.map(t => parseOrThrow(TaskListItemSchema, t, 'dashboard.allTasks'));
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If `DashboardTaskDetailSchema` fields don't match `toTaskDetail()` output exactly (e.g. missing `predecessor` field), update the `toTaskDetail` method to include the missing fields or update the schema — do not cast with `as any`.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboard.controller.ts
git commit -m "feat(contracts): enforce response schemas in DashboardController"
```

---

## Task 14: Full test suite + final build check

- [ ] **Step 1: Run all contract tests**

```bash
npx jest src/contracts/ --no-coverage 2>&1 | tail -20
```

Expected: all tests pass, 0 failures

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -25
```

Expected: all previously-passing tests still pass

- [ ] **Step 3: Full TypeScript build**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors)

- [ ] **Step 4: Final commit if any fixups were needed**

```bash
git add -p  # stage only fix files
git commit -m "fix(contracts): address type errors from full build check"
```

---

## Self-Review

**Spec coverage:**
- ✅ `ContractViolationError` + `parseOrThrow` — Task 1
- ✅ Global exception filter + critical notification — Task 2
- ✅ AI schemas: GlobalCoordinator, GoalReview, CodingPlan — Tasks 3, 5–8
- ✅ HTTP response schemas — Task 4
- ✅ HTTP enforcement: all 10 controllers — Tasks 9–13
- ✅ Tests: parse-or-throw.spec.ts + contracts.spec.ts additions — Tasks 1, 3, 4
- ✅ Fail-fast: `parseOrWarn` not introduced anywhere
- ✅ Metrics `getPrometheus` (text/plain) correctly excluded from JSON contract

**Known edge cases addressed:**
- `AgentsController.disable/enable` — return type from service needs checking at build time (Task 11 note)
- `ProjectsController.offboard/unregister` — return type may not match `ProjectResponseSchema` (Task 10 note)
- `DashboardTaskDetailSchema` — `toTaskDetail()` shape must align exactly (Task 13 note)
