# JSON Contracts Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three remaining JSON contract gaps: (1) validate AI requests before they leave `AiHttpClient`, (2) validate `CcPlannerService` output via a proper Zod schema, and (3) replace free-form `@Body()` objects in Dashboard and Goals controllers with typed DTOs so the global `ValidationPipe` covers them.

**Architecture:** All new Zod schemas go into `src/contracts/` (existing pattern). New DTOs go into `src/dashboard/dto/` and alongside the goals controller. `AiHttpClient.call()` gains an outgoing request parse before the axios call. No DB changes, no new modules.

**Tech Stack:** NestJS, TypeScript, Zod (already installed), class-validator + class-transformer (already used for DTOs)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/contracts/ai-complete.contract.ts` | Already exists — no change needed (schema is already correct) |
| Modify | `src/worker/ai-http.client.ts` | Parse `params` against `AiCompleteRequestSchema` before axios call |
| Create | `src/contracts/cc-planner-output.contract.ts` | Zod schema for `CcPlannerOutput` |
| Modify | `src/contracts/index.ts` | Re-export the new schema |
| Modify | `src/cc-planner/cc-planner.service.ts` | Replace hand-rolled checks with `CcPlannerOutputSchema.safeParse()` |
| Create | `src/dashboard/dto/reject-task.dto.ts` | `{ reason: string }` with `@IsString @IsNotEmpty` |
| Create | `src/dashboard/dto/answer-task.dto.ts` | `{ answer: string }` with `@IsString @IsNotEmpty` |
| Create | `src/dashboard/dto/bulk-delete-tasks.dto.ts` | `{ ids: string[] }` with `@IsArray @IsUUID each @ArrayMaxSize(1000)` |
| Create | `src/dashboard/dto/set-execution-mode.dto.ts` | `{ mode: string }` with `@IsIn(['manual'])` |
| Modify | `src/dashboard/dashboard.controller.ts` | Replace raw `body: { ... }` with DTO params |
| Create | `src/goals/dto/cancel-goal.dto.ts` | `{ reason?: string }` with `@IsOptional @IsString` |
| Modify | `src/goals/goals.controller.ts` | Replace raw `body: { reason?: string }` with `CancelGoalDto` |
| Modify | `src/contracts/contracts.spec.ts` | Add tests for `CcPlannerOutputSchema` |

---

### Task 1: Validate outgoing AI request in AiHttpClient

**Files:**
- Modify: `src/worker/ai-http.client.ts`
- Test: `src/worker/ai-http.client.ts` (existing behaviour, add inline test in worker-agent-contracts.spec.ts)

- [ ] **Step 1: Write a failing test confirming invalid request is caught**

Add to `src/worker/worker-agent-contracts.spec.ts`:

```typescript
import { AiCompleteRequestSchema } from '../contracts';

describe('AiCompleteRequestSchema — outgoing request validation', () => {
  it('rejects missing model_tier', () => {
    const result = AiCompleteRequestSchema.safeParse({ user_prompt: 'hello' });
    expect(result.success).toBe(false);
  });

  it('rejects empty user_prompt', () => {
    const result = AiCompleteRequestSchema.safeParse({ model_tier: 'free', user_prompt: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid model_tier', () => {
    const result = AiCompleteRequestSchema.safeParse({ model_tier: 'turbo', user_prompt: 'hi' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid request', () => {
    const result = AiCompleteRequestSchema.safeParse({
      model_tier: 'free',
      user_prompt: 'do something',
      max_tokens: 500,
      correlation_id: 'abc-123',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm tests pass (schema already correct)**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest src/worker/worker-agent-contracts.spec.ts --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Add request validation to AiHttpClient.call()**

Open `src/worker/ai-http.client.ts`. The `call()` method currently starts with:

```typescript
async call(params: unknown): Promise<AiCompleteResponse> {
  const key = this.cacheKey(params as Record<string, unknown>);
```

Change the method to validate `params` before the cache key lookup:

```typescript
async call(params: unknown): Promise<AiCompleteResponse> {
  const requestCheck = AiCompleteRequestSchema.safeParse(params);
  if (!requestCheck.success) {
    throw new Error(`AI request contract violation: ${JSON.stringify(requestCheck.error.issues)}`);
  }
  const key = this.cacheKey(params as Record<string, unknown>);
```

Also add the import at the top of the file (it already imports `AiCompleteResponseSchema` — extend it):

```typescript
import { AiCompleteResponseSchema, AiCompleteRequestSchema } from '../contracts';
```

- [ ] **Step 4: Run all worker tests to check for regressions**

```bash
npx jest src/worker/ --no-coverage
```

Expected: all tests pass. If any test mocks `aiHttp.call()` with an invalid shape, those mocks will need updating — the test will tell you which ones.

- [ ] **Step 5: Commit**

```bash
git add src/worker/ai-http.client.ts src/worker/worker-agent-contracts.spec.ts
git commit -m "feat(contracts): validate outgoing AI request schema in AiHttpClient.call()"
```

---

### Task 2: Add CcPlannerOutput Zod schema and use it

**Files:**
- Create: `src/contracts/cc-planner-output.contract.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/cc-planner/cc-planner.service.ts`
- Modify: `src/contracts/contracts.spec.ts`

- [ ] **Step 1: Write failing tests for the new schema**

Add to `src/contracts/contracts.spec.ts`:

```typescript
import { CcPlannerOutputSchema } from './cc-planner-output.contract';

describe('CcPlannerOutputSchema', () => {
  const validTask = {
    type: 'implement:feature',
    idempotency_key: 'task-001',
    payload_ref: { description: 'do it' },
    acceptance_criteria: ['output_present'],
    priority: 1,
    max_attempts: 3,
    target_service: 'my-service',
    smoke_test_urls: [],
  };

  it('accepts a valid output', () => {
    const result = CcPlannerOutputSchema.safeParse({
      new_tasks: [validTask],
      state_patch: { health: 'ok' },
      decisions: ['spawned 1 task'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a task missing idempotency_key', () => {
    const bad = { ...validTask };
    delete (bad as any).idempotency_key;
    const result = CcPlannerOutputSchema.safeParse({
      new_tasks: [bad],
      state_patch: {},
      decisions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a task with invalid priority (> 5)', () => {
    const result = CcPlannerOutputSchema.safeParse({
      new_tasks: [{ ...validTask, priority: 10 }],
      state_patch: {},
      decisions: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty new_tasks', () => {
    const result = CcPlannerOutputSchema.safeParse({
      new_tasks: [],
      state_patch: {},
      decisions: [],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm tests fail (schema doesn't exist yet)**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: error about missing `cc-planner-output.contract`

- [ ] **Step 3: Create the schema**

Create `src/contracts/cc-planner-output.contract.ts`:

```typescript
import { z } from 'zod';

export const CcPlannerTaskSchema = z.object({
  type: z.string().min(1),
  idempotency_key: z.string().min(1),
  payload_ref: z.record(z.string(), z.unknown()),
  acceptance_criteria: z.array(z.string()).max(3),
  priority: z.number().int().min(1).max(5),
  max_attempts: z.number().int().min(1).max(10),
  target_service: z.string().min(1),
  smoke_test_urls: z.array(z.string().url()).default([]),
});

export const CcPlannerOutputSchema = z.object({
  new_tasks: z.array(CcPlannerTaskSchema),
  state_patch: z.record(z.string(), z.unknown()),
  decisions: z.array(z.string()),
});

export type CcPlannerTask = z.infer<typeof CcPlannerTaskSchema>;
export type CcPlannerOutput = z.infer<typeof CcPlannerOutputSchema>;
```

- [ ] **Step 4: Export from barrel**

In `src/contracts/index.ts`, add:

```typescript
export * from './cc-planner-output.contract';
```

- [ ] **Step 5: Run contract tests to confirm they pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage
```

Expected: all tests pass including the 4 new ones

- [ ] **Step 6: Replace hand-rolled validation in CcPlannerService**

Open `src/cc-planner/cc-planner.service.ts`. Add import at top:

```typescript
import { CcPlannerOutputSchema } from '../contracts';
```

Find the block after the `response` is returned from `this.aiHttp.call(...)` — it currently has these hand-rolled checks:

```typescript
    if (!Array.isArray(response['new_tasks'])) {
      // ...
      throw new Error('cc_planner_invalid_json');
    }

    const tasks = response['new_tasks'] as Array<Record<string, unknown>>;
    const malformed = tasks.find(
      (t) => typeof t['type'] !== 'string' || typeof t['idempotency_key'] !== 'string',
    );
    if (malformed) {
      // ...
      throw new Error('cc_planner_invalid_json');
    }

    return {
      new_tasks: tasks as unknown as CcPlannerOutput['new_tasks'],
      state_patch: (response['state_patch'] as Record<string, unknown>) ?? {},
      decisions: Array.isArray(response['decisions']) ? response['decisions'] as string[] : [],
    };
```

Replace that entire block with:

```typescript
    const contractCheck = CcPlannerOutputSchema.safeParse({
      new_tasks: response['new_tasks'],
      state_patch: response['state_patch'] ?? {},
      decisions: response['decisions'] ?? [],
    });
    if (!contractCheck.success) {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_invalid_json',
        projectId: input.projectId, durationMs: 0,
        metadata: {
          errors: contractCheck.error.issues,
          response_keys: Object.keys(response).slice(0, 10),
        },
      });
      throw new Error('cc_planner_invalid_json');
    }

    return contractCheck.data;
```

Also remove the now-unused `CcPlannerOutput` type import from `cc-planner.service.ts` if it was a local interface (replace it with the imported type from contracts):

At the top, where `CcPlannerOutput` is used as a return type, change:

```typescript
// Before (inline interface):
export interface CcPlannerOutput { ... }

// After: import from contracts
import { CcPlannerOutput } from '../contracts';
```

And update the `plan()` return type annotation to use the imported `CcPlannerOutput`.

- [ ] **Step 7: Run cc-planner and contract tests**

```bash
npx jest src/cc-planner/ src/contracts/ --no-coverage
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/contracts/cc-planner-output.contract.ts src/contracts/index.ts src/contracts/contracts.spec.ts src/cc-planner/cc-planner.service.ts
git commit -m "feat(contracts): add CcPlannerOutputSchema and replace hand-rolled validation in CcPlannerService"
```

---

### Task 3: DTO for GoalsController cancel body

**Files:**
- Create: `src/goals/dto/cancel-goal.dto.ts`
- Modify: `src/goals/goals.controller.ts`

- [ ] **Step 1: Create the DTO**

Create `src/goals/dto/cancel-goal.dto.ts`:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class CancelGoalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
```

- [ ] **Step 2: Update GoalsController to use CancelGoalDto**

Open `src/goals/goals.controller.ts`. Find the `cancelGoal` method:

```typescript
  @Patch('projects/:projectId/goals/:goalId/cancel')
  async cancelGoal(
    @Param('goalId') goalId: string,
    @Body() body: { reason?: string },
  ) {
    return this.goalsService.cancel(goalId, body?.reason);
  }
```

Replace with:

```typescript
  @Patch('projects/:projectId/goals/:goalId/cancel')
  async cancelGoal(
    @Param('goalId') goalId: string,
    @Body() dto: CancelGoalDto,
  ) {
    return this.goalsService.cancel(goalId, dto.reason);
  }
```

Also add the import at the top of `goals.controller.ts`:

```typescript
import { CancelGoalDto } from './dto/cancel-goal.dto';
```

- [ ] **Step 3: Run goal-related tests**

```bash
npx jest src/goals/ --no-coverage
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/goals/dto/cancel-goal.dto.ts src/goals/goals.controller.ts
git commit -m "feat(contracts): add CancelGoalDto — goals cancel body now goes through ValidationPipe"
```

---

### Task 4: DTOs for DashboardController free-form bodies

**Files:**
- Create: `src/dashboard/dto/reject-task.dto.ts`
- Create: `src/dashboard/dto/answer-task.dto.ts`
- Create: `src/dashboard/dto/bulk-delete-tasks.dto.ts`
- Create: `src/dashboard/dto/set-execution-mode.dto.ts`
- Modify: `src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Create the four DTOs**

Create `src/dashboard/dto/reject-task.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class RejectTaskDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
```

Create `src/dashboard/dto/answer-task.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class AnswerTaskDto {
  @IsString()
  @IsNotEmpty()
  answer: string;
}
```

Create `src/dashboard/dto/bulk-delete-tasks.dto.ts`:

```typescript
import { IsArray, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkDeleteTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  ids: string[];
}
```

Create `src/dashboard/dto/set-execution-mode.dto.ts`:

```typescript
import { IsIn } from 'class-validator';

export class SetExecutionModeDto {
  @IsIn(['manual'])
  mode: string;
}
```

- [ ] **Step 2: Update DashboardController**

Open `src/dashboard/dashboard.controller.ts`. Add imports at the top:

```typescript
import { RejectTaskDto } from './dto/reject-task.dto';
import { AnswerTaskDto } from './dto/answer-task.dto';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';
import { SetExecutionModeDto } from './dto/set-execution-mode.dto';
```

Find and replace each method signature:

**`bulkDeleteTasks`** — replace:
```typescript
  async bulkDeleteTasks(@Body() body: { ids: string[] }) {
    const ids: string[] = body?.ids ?? [];
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids array is required');
    if (ids.length > 1000) throw new BadRequestException('Cannot delete more than 1000 tasks at once');
    const deletedExecutions = await this.executionsService.deleteByTaskIds(ids);
    const deletedTasks = await this.tasksService.deleteByIds(ids);
    return { deletedTasks, deletedExecutions };
  }
```
With:
```typescript
  async bulkDeleteTasks(@Body() dto: BulkDeleteTasksDto) {
    const deletedExecutions = await this.executionsService.deleteByTaskIds(dto.ids);
    const deletedTasks = await this.tasksService.deleteByIds(dto.ids);
    return { deletedTasks, deletedExecutions };
  }
```

**`rejectTask`** — replace:
```typescript
  async rejectTask(
    @Param('taskId') taskId: string,
    @Body() body: { reason?: string },
  ) {
    if (!body?.reason) throw new BadRequestException('reason is required');
    const task = await this.tasksService.rejectTask(taskId, body.reason);
```
With:
```typescript
  async rejectTask(
    @Param('taskId') taskId: string,
    @Body() dto: RejectTaskDto,
  ) {
    const task = await this.tasksService.rejectTask(taskId, dto.reason);
```

**`answerTask`** — replace:
```typescript
  async answerTask(
    @Param('taskId') taskId: string,
    @Body() body: { answer?: string },
  ) {
    if (!body?.answer) throw new BadRequestException('answer is required');
    const task = await this.tasksService.answerTask(taskId, body.answer);
```
With:
```typescript
  async answerTask(
    @Param('taskId') taskId: string,
    @Body() dto: AnswerTaskDto,
  ) {
    const task = await this.tasksService.answerTask(taskId, dto.answer);
```

**`setExecutionMode`** — replace:
```typescript
  async setExecutionMode(
    @Param('projectId') projectId: string,
    @Body() body: { mode?: string },
  ) {
    if (body?.mode !== 'manual') {
      throw new BadRequestException('mode must be manual — auto execution is disabled, all tasks require explicit user approval');
    }
    const project = await this.projectsService.setExecutionMode(projectId, body.mode);
    return { ok: true, executionMode: project.executionMode };
  }
```
With:
```typescript
  async setExecutionMode(
    @Param('projectId') projectId: string,
    @Body() dto: SetExecutionModeDto,
  ) {
    const project = await this.projectsService.setExecutionMode(projectId, dto.mode);
    return { ok: true, executionMode: project.executionMode };
  }
```

Also remove `BadRequestException` from the `@nestjs/common` import line — all four usages are in the replaced methods, so it's now unused. The import line becomes:

```typescript
import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
```

- [ ] **Step 3: Run dashboard tests**

```bash
npx jest src/dashboard/ --no-coverage
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/dto/ src/dashboard/dashboard.controller.ts
git commit -m "feat(contracts): replace free-form @Body() with typed DTOs in DashboardController"
```

---

### Task 5: Route ValidatorAgentService semantic review through AiHttpClient

**Files:**
- Modify: `src/validator/validator-agent.service.ts`

The `runSemanticReview` method calls `axios.post` directly, bypassing the `AiHttpClient` (and therefore both request and response contract validation). This task routes it through `AiHttpClient`.

- [ ] **Step 1: Write a test confirming the semantic review path calls AiHttpClient**

Add to `src/validator/validator-agent.service.spec.ts` (or create a new describe block if the file exists):

```typescript
it('routes semantic LLM review through AiHttpClient, not raw axios', async () => {
  // This test checks that runSemanticReview goes through AiHttpClient.call()
  // by verifying the AiHttpClient mock is called when an unrecognised criterion is passed
  const mockAiHttp = { call: jest.fn().mockResolvedValue({ text: '{"passed":true,"issues":[]}', model_used: 'free' }) };
  // Re-instantiate with mock — verify call() is invoked
  // (exact setup depends on how the test file initialises ValidatorAgentService)
  expect(mockAiHttp.call).toHaveBeenCalled();
});
```

Note: the exact test shape depends on existing test scaffolding in `validator-agent.service.spec.ts`. Open that file first to see how the service is constructed in tests, then write the test matching that pattern.

- [ ] **Step 2: Inject AiHttpClient into ValidatorAgentService**

Open `src/validator/validator-agent.service.ts`. The constructor currently takes:

```typescript
constructor(
  private readonly logger: LoggingClient,
  private readonly configService: ConfigService,
) {
  this.aiUrl = ...
  this.aiToken = ...
}
```

Add `AiHttpClient` injection:

```typescript
import { AiHttpClient } from '../worker/ai-http.client';

constructor(
  private readonly logger: LoggingClient,
  private readonly configService: ConfigService,
  private readonly aiHttp: AiHttpClient,
) {}
```

Remove the `aiUrl` and `aiToken` instance fields and their `configService.get` calls from the constructor body — they're only used in `runSemanticReview`.

- [ ] **Step 3: Replace raw axios call in runSemanticReview**

Find `runSemanticReview`. It currently does:

```typescript
const response = await axios.post(
  `${this.aiUrl}/ai/complete`,
  {
    model_tier: 'smart',
    user_prompt: `...`,
    output_schema: { ... },
    max_tokens: 400,
    correlation_id: uuidv4(),
  },
  {
    timeout: 20000,
    headers: this.aiToken ? { Authorization: `Bearer ${this.aiToken}` } : {},
  },
);
const result = extractStructuredOutput(response.data as Record<string, unknown>);
```

Replace with:

```typescript
const result = await this.aiHttp.call({
  model_tier: 'smart',
  user_prompt: `${VALIDATOR_INSTRUCTION}\n\n${JSON.stringify({
    task_id: input.taskId,
    output_ref: input.outputRef,
    criteria: input.acceptanceCriteria.filter((c) => c !== LLM_REVIEW_CRITERION),
  })}`,
  output_schema: {
    type: 'object',
    required: ['passed', 'issues'],
    properties: {
      passed: { type: 'boolean' },
      issues: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    },
  },
  max_tokens: 400,
  correlation_id: uuidv4(),
});
```

Note: `aiHttp.call()` already calls `extractStructuredOutput` internally, so `result` is already the merged object.

Also remove the `axios` import and `extractStructuredOutput` import if they're no longer used elsewhere in this file.

- [ ] **Step 4: Register AiHttpClient in ValidatorModule**

Open `src/validator/validator.module.ts`. Add `AiHttpClient` to providers (it needs `RedisService` and `ConfigService` which are likely already imported):

```typescript
import { AiHttpClient } from '../worker/ai-http.client';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [/* existing */ RedisModule],
  providers: [ValidatorAgentService, AiHttpClient],
  exports: [ValidatorAgentService],
})
```

If `RedisModule` is already imported or `AiHttpClient` is provided by the worker module, check the existing imports in `validator.module.ts` first and adjust accordingly.

- [ ] **Step 5: Run validator tests**

```bash
npx jest src/validator/ --no-coverage
```

Expected: all pass

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all test suites pass

- [ ] **Step 7: TypeScript build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/validator/validator-agent.service.ts src/validator/validator.module.ts
git commit -m "feat(contracts): route ValidatorAgent semantic review through AiHttpClient for contract validation"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full test suite**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass, no regressions

- [ ] **Step 2: TypeScript build**

```bash
npx tsc --noEmit
```

Expected: exit 0, no output

- [ ] **Step 3: Verify health endpoint**

```bash
kubectl exec -n statex-apps deployment/runlayer -- wget -qO- http://localhost:3390/health
```

Expected: `{"status":"ok"}`
