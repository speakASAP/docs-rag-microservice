# JSON Contracts — Remaining HTTP Response Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last 6 uncontracted HTTP controller response boundaries that are registered in `AppModule` and still return raw/unvalidated shapes.

**Architecture:** Add 5 small response schemas to `src/contracts/http-responses.contract.ts`, wire `parseOrThrow` in the 4 controller files, add matching tests to `contracts.spec.ts`, and post a closure comment to GitHub issue #21.

**Tech Stack:** NestJS, Zod (`parseOrThrow` already available), TypeScript

---

## Boundary audit — gaps in active, registered controllers

| Controller | Method | Current return | Gap |
|---|---|---|---|
| `escalations/escalations.controller.ts` | `list()` | raw entity array | no `parseOrThrow` |
| `dashboard/dashboard.controller.ts` | `taskLogs()` | `{ logs }` | no schema |
| `dashboard/dashboard.controller.ts` | `enableWorkers()` | `{ enabled, message }` | no schema |
| `dashboard/dashboard.controller.ts` | `setExecutionMode()` | `{ ok, executionMode }` | no schema |
| `projects/projects.controller.ts` | `hardUnregister()` | `{ id, unregistered }` | no schema |
| `goals/goals.controller.ts` | `deleteGoal()` | `{ ok: true }` | no schema |

Everything else in active controllers already uses `parseOrThrow`. Legacy controllers (`src/coordinator/goals.controller.ts`, `src/controllers/*`, `src/modules/*`, `src/app.controller.ts`) are **not registered** in `AppModule` — skip them.

---

## File Map

| Action | File |
|--------|------|
| **MODIFY** | `src/contracts/http-responses.contract.ts` — add 5 new schemas |
| **MODIFY** | `src/escalations/escalations.controller.ts` — wire `parseOrThrow` on `list()` |
| **MODIFY** | `src/dashboard/dashboard.controller.ts` — wire `parseOrThrow` on 3 endpoints |
| **MODIFY** | `src/projects/projects.controller.ts` — wire `parseOrThrow` on `hardUnregister()` |
| **MODIFY** | `src/goals/goals.controller.ts` — wire `parseOrThrow` on `deleteGoal()` |
| **MODIFY** | `src/contracts/contracts.spec.ts` — add tests for 5 new schemas |

---

## Task 1: Add 5 new response schemas

**Files:**
- Modify: `src/contracts/http-responses.contract.ts`

- [ ] **Step 1: Add the 5 schemas at the bottom of `http-responses.contract.ts`**

Append after `LlmLogsResultSchema`:

```typescript
// ---- Escalations list ----

export const EscalationListResponseSchema = z.array(EscalationResponseSchema);
export type EscalationListResponse = z.infer<typeof EscalationListResponseSchema>;

// ---- Task logs ----

export const TaskLogsResponseSchema = z.object({
  logs: z.array(z.object({
    level: z.string(),
    message: z.string(),
    timestamp: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
  error: z.string().optional(),
});
export type TaskLogsResponse = z.infer<typeof TaskLogsResponseSchema>;

// ---- Admin agent ops ----

export const EnableWorkersResponseSchema = z.object({
  enabled: z.number().int().nonnegative(),
  message: z.string(),
});
export type EnableWorkersResponse = z.infer<typeof EnableWorkersResponseSchema>;

export const SetExecutionModeResponseSchema = z.object({
  ok: z.boolean(),
  executionMode: z.enum(['manual', 'auto']),
});
export type SetExecutionModeResponse = z.infer<typeof SetExecutionModeResponseSchema>;

// ---- Projects ----

export const HardUnregisterResponseSchema = z.object({
  id: z.string(),
  unregistered: z.boolean(),
});
export type HardUnregisterResponse = z.infer<typeof HardUnregisterResponseSchema>;

// ---- Simple ok ----

export const OkResponseSchema = z.object({
  ok: z.literal(true),
});
export type OkResponse = z.infer<typeof OkResponseSchema>;
```

- [ ] **Step 2: Export the new schemas from `src/contracts/index.ts`**

The existing `index.ts` already has `export * from './http-responses.contract';` — no change needed since all new exports are in that file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -30`
Expected: zero new errors for the modified files.

---

## Task 2: Wire contracts in escalations.controller.ts

**Files:**
- Modify: `src/escalations/escalations.controller.ts`

- [ ] **Step 1: Update the import line and add `parseOrThrow` to `list()`**

Current:
```typescript
import { parseOrThrow, EscalationResponseSchema } from '../contracts';
```

Change to:
```typescript
import { parseOrThrow, EscalationResponseSchema, EscalationListResponseSchema } from '../contracts';
```

Current `list()` method:
```typescript
  @Get()
  list(
    @Query('project_id') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.escalationsService.findAll({ projectId, status });
  }
```

Replace with:
```typescript
  @Get()
  async list(
    @Query('project_id') projectId?: string,
    @Query('status') status?: string,
  ) {
    const results = await this.escalationsService.findAll({ projectId, status });
    return parseOrThrow(EscalationListResponseSchema, results, 'escalations.list');
  }
```

- [ ] **Step 2: TypeScript check**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | grep "escalations.controller" | head -10`
Expected: no errors.

---

## Task 3: Wire contracts in dashboard.controller.ts (3 endpoints)

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Add new schemas to the import from contracts**

Find the contracts import block and add `TaskLogsResponseSchema, EnableWorkersResponseSchema, SetExecutionModeResponseSchema`:

Existing import (around line 18):
```typescript
import {
  parseOrThrow,
  DashboardOverviewSchema,
  ...
} from '../contracts';
```

Add `TaskLogsResponseSchema`, `EnableWorkersResponseSchema`, `SetExecutionModeResponseSchema` to that list.

- [ ] **Step 2: Wrap `taskLogs()` return**

Current (around line 155–165):
```typescript
      const logs = raw.map((entry) => ({
        level: entry.level || 'info',
        message: entry.message || entry.msg || '(no message)',
        timestamp: entry.timestamp,
        metadata: entry.metadata ?? {},
      }));
      return { logs };
    } catch {
      return { logs: [], error: 'logging service unavailable' };
    }
```

Replace with:
```typescript
      const logs = raw.map((entry) => ({
        level: entry.level || 'info',
        message: entry.message || entry.msg || '(no message)',
        timestamp: entry.timestamp,
        metadata: entry.metadata ?? {},
      }));
      return parseOrThrow(TaskLogsResponseSchema, { logs }, 'dashboard.taskLogs');
    } catch {
      return parseOrThrow(TaskLogsResponseSchema, { logs: [], error: 'logging service unavailable' }, 'dashboard.taskLogs');
    }
```

- [ ] **Step 3: Wrap `enableWorkers()` return**

Current (around line 191):
```typescript
    return { enabled: count, message: `${count} worker(s) set to idle` };
```

Replace with:
```typescript
    return parseOrThrow(EnableWorkersResponseSchema, { enabled: count, message: `${count} worker(s) set to idle` }, 'dashboard.enableWorkers');
```

- [ ] **Step 4: Wrap `setExecutionMode()` return**

Current (around line 302):
```typescript
    return { ok: true, executionMode: project.executionMode };
```

Replace with:
```typescript
    return parseOrThrow(SetExecutionModeResponseSchema, { ok: true, executionMode: project.executionMode }, 'dashboard.setExecutionMode');
```

- [ ] **Step 5: TypeScript check**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | grep "dashboard.controller" | head -10`
Expected: no errors.

---

## Task 4: Wire contracts in projects.controller.ts

**Files:**
- Modify: `src/projects/projects.controller.ts`

- [ ] **Step 1: Add `HardUnregisterResponseSchema` to import**

Current import:
```typescript
import { parseOrThrow, ProjectResponseSchema } from '../contracts';
```

Change to:
```typescript
import { parseOrThrow, ProjectResponseSchema, HardUnregisterResponseSchema } from '../contracts';
```

- [ ] **Step 2: Wrap `hardUnregister()` return**

Current:
```typescript
  @Post(':projectId/unregister')
  unregister(@Param('projectId') projectId: string, @Body() dto: HardUnregisterProjectDto) {
    // Returns { id, unregistered: true } — no HTTP response schema defined, pass through as-is
    return this.service.hardUnregister(projectId, dto);
  }
```

Replace with:
```typescript
  @Post(':projectId/unregister')
  async unregister(@Param('projectId') projectId: string, @Body() dto: HardUnregisterProjectDto) {
    const result = await this.service.hardUnregister(projectId, dto);
    return parseOrThrow(HardUnregisterResponseSchema, result, 'projects.hardUnregister');
  }
```

- [ ] **Step 3: TypeScript check**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | grep "projects.controller" | head -10`
Expected: no errors.

---

## Task 5: Wire contracts in goals.controller.ts

**Files:**
- Modify: `src/goals/goals.controller.ts`

- [ ] **Step 1: Add `OkResponseSchema` to import**

Current import:
```typescript
import { parseOrThrow, GoalResponseSchema } from '../contracts';
```

Change to:
```typescript
import { parseOrThrow, GoalResponseSchema, OkResponseSchema } from '../contracts';
```

- [ ] **Step 2: Wrap `deleteGoal()` return**

Current:
```typescript
  @Delete('projects/:projectId/goals/:goalId')
  async deleteGoal(
    @Param('goalId') goalId: string,
  ) {
    await this.goalsService.deleteGoal(goalId);
    return { ok: true };
  }
```

Replace with:
```typescript
  @Delete('projects/:projectId/goals/:goalId')
  async deleteGoal(
    @Param('goalId') goalId: string,
  ) {
    await this.goalsService.deleteGoal(goalId);
    return parseOrThrow(OkResponseSchema, { ok: true as const }, 'goals.deleteGoal');
  }
```

- [ ] **Step 3: TypeScript check**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | grep "goals.controller" | head -10`
Expected: no errors.

---

## Task 6: Add tests for the 5 new schemas

**Files:**
- Modify: `src/contracts/contracts.spec.ts`

- [ ] **Step 1: Add tests at the bottom of `contracts.spec.ts`**

Add the following import block and describe blocks:

```typescript
import {
  TaskLogsResponseSchema,
  EnableWorkersResponseSchema,
  SetExecutionModeResponseSchema,
  HardUnregisterResponseSchema,
  OkResponseSchema,
  EscalationListResponseSchema,
} from './http-responses.contract';

describe('EscalationListResponseSchema', () => {
  const validItem = {
    id: 'esc-1',
    businessId: null,
    projectId: 'proj-1',
    taskId: null,
    level: 'warn',
    subject: 'Test alert',
    body: 'Something failed',
    status: 'open',
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    resolverNote: null,
  };
  it('accepts empty array', () => {
    expect(EscalationListResponseSchema.safeParse([]).success).toBe(true);
  });
  it('accepts valid escalation items', () => {
    expect(EscalationListResponseSchema.safeParse([validItem]).success).toBe(true);
  });
  it('rejects item with invalid level', () => {
    expect(EscalationListResponseSchema.safeParse([{ ...validItem, level: 'debug' }]).success).toBe(false);
  });
});

describe('TaskLogsResponseSchema', () => {
  it('accepts valid logs response', () => {
    const r = TaskLogsResponseSchema.safeParse({
      logs: [{ level: 'info', message: 'hello', timestamp: '2026-01-01T00:00:00Z', metadata: {} }],
    });
    expect(r.success).toBe(true);
  });
  it('accepts error response with empty logs', () => {
    const r = TaskLogsResponseSchema.safeParse({
      logs: [],
      error: 'logging service unavailable',
    });
    expect(r.success).toBe(true);
  });
  it('rejects missing logs field', () => {
    expect(TaskLogsResponseSchema.safeParse({ error: 'oops' }).success).toBe(false);
  });
});

describe('EnableWorkersResponseSchema', () => {
  it('accepts valid response', () => {
    expect(EnableWorkersResponseSchema.safeParse({ enabled: 3, message: '3 worker(s) set to idle' }).success).toBe(true);
  });
  it('rejects negative enabled count', () => {
    expect(EnableWorkersResponseSchema.safeParse({ enabled: -1, message: 'x' }).success).toBe(false);
  });
  it('rejects missing message', () => {
    expect(EnableWorkersResponseSchema.safeParse({ enabled: 1 }).success).toBe(false);
  });
});

describe('SetExecutionModeResponseSchema', () => {
  it('accepts manual mode', () => {
    expect(SetExecutionModeResponseSchema.safeParse({ ok: true, executionMode: 'manual' }).success).toBe(true);
  });
  it('accepts auto mode', () => {
    expect(SetExecutionModeResponseSchema.safeParse({ ok: true, executionMode: 'auto' }).success).toBe(true);
  });
  it('rejects unknown mode', () => {
    expect(SetExecutionModeResponseSchema.safeParse({ ok: true, executionMode: 'turbo' }).success).toBe(false);
  });
  it('rejects ok=false', () => {
    expect(SetExecutionModeResponseSchema.safeParse({ ok: false, executionMode: 'auto' }).success).toBe(false);
  });
});

describe('HardUnregisterResponseSchema', () => {
  it('accepts valid response', () => {
    expect(HardUnregisterResponseSchema.safeParse({ id: 'proj-1', unregistered: true }).success).toBe(true);
  });
  it('rejects missing id', () => {
    expect(HardUnregisterResponseSchema.safeParse({ unregistered: true }).success).toBe(false);
  });
  it('rejects non-boolean unregistered', () => {
    expect(HardUnregisterResponseSchema.safeParse({ id: 'p1', unregistered: 'yes' }).success).toBe(false);
  });
});

describe('OkResponseSchema', () => {
  it('accepts { ok: true }', () => {
    expect(OkResponseSchema.safeParse({ ok: true }).success).toBe(true);
  });
  it('rejects { ok: false }', () => {
    expect(OkResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
  it('rejects missing ok', () => {
    expect(OkResponseSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run only the contracts spec to verify all tests pass**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | tail -20`
Expected: all tests pass, no failures.

---

## Task 7: Full TypeScript build check

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -40`
Expected: zero errors introduced by this work.

- [ ] **Step 2: Run full contract test suite**

Run: `cd /home/ssf/Documents/Github/business-orchestrator && npx jest src/contracts/ --no-coverage 2>&1 | tail -20`
Expected: all tests pass (was ~82, now ~100+).

---

## Task 8: Update GitHub issue #21

- [ ] **Step 1: Post closure comment**

```bash
gh issue comment 21 --repo speakASAP/business-orchestrator --body "## Remaining gaps closed (2026-05-29 — phase 3)

Final 6 uncontracted HTTP response boundaries now covered.

### Gaps closed

| Boundary | Fix |
|---|---|
| \`EscalationsController.list()\` | Wrapped with \`parseOrThrow(EscalationListResponseSchema)\` |
| \`DashboardController.taskLogs()\` | Added \`TaskLogsResponseSchema\`, both success and error paths wrapped |
| \`DashboardController.enableWorkers()\` | Added \`EnableWorkersResponseSchema\`, wrapped return |
| \`DashboardController.setExecutionMode()\` | Added \`SetExecutionModeResponseSchema\`, wrapped return |
| \`ProjectsController.hardUnregister()\` | Added \`HardUnregisterResponseSchema\`, made async + wrapped |
| \`GoalsController.deleteGoal()\` | Added \`OkResponseSchema\`, wrapped \`{ ok: true }\` return |

### New schemas added (all in \`http-responses.contract.ts\`)
- \`EscalationListResponseSchema\`
- \`TaskLogsResponseSchema\`
- \`EnableWorkersResponseSchema\`
- \`SetExecutionModeResponseSchema\`
- \`HardUnregisterResponseSchema\`
- \`OkResponseSchema\`

### Tests
- 18 new tests added
- Total contract test suite: ~100 tests

**Every active HTTP controller boundary in AppModule now uses \`parseOrThrow\`. Contract enforcement is complete.**"
```

---

## Self-Review

**Spec coverage:**
- 6 gaps identified → 6 tasks cover them ✓
- New schemas for each shape ✓
- Tests for each new schema ✓
- Issue update ✓

**Placeholder scan:** None.

**Type consistency:**
- `EscalationListResponseSchema = z.array(EscalationResponseSchema)` — uses existing `EscalationResponseSchema` ✓
- `OkResponseSchema` uses `z.literal(true)` — caller in `goals.controller.ts` must pass `{ ok: true as const }` ✓
- `SetExecutionModeResponseSchema.executionMode` is `z.enum(['manual', 'auto'])` — matches `project.executionMode` DB column ✓
