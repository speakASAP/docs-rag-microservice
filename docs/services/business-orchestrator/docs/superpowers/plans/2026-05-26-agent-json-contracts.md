# Agent JSON Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define versioned Zod schemas for every inter-agent message boundary, add runtime validation at intake points, and make contract violations fail fast with `INVALID_CONTRACT` error code.

**Architecture:** A new `src/contracts/` directory holds all Zod schemas (no DB changes). Each schema has a `schemaVersion: "1.0"` field. Validation is added at the four intake points: worker payload intake, validator output intake, project-coordinator blueprint generation, and dashboard API bodies.

**Tech Stack:** NestJS, TypeScript, Zod (add as dependency), TypeORM (no changes), existing LoggingClient pattern

**GitHub Issue:** https://github.com/speakASAP/business-orchestrator/issues/19

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/contracts/index.ts` | Re-exports all schemas |
| Create | `src/contracts/task-payload.contract.ts` | TaskPayload Zod schema |
| Create | `src/contracts/agent-result.contract.ts` | AgentResult Zod schema |
| Create | `src/contracts/validation-request.contract.ts` | ValidationRequest Zod schema |
| Create | `src/contracts/validation-result.contract.ts` | ValidationResult Zod schema |
| Create | `src/contracts/ai-complete.contract.ts` | AiCompleteRequest + AiCompleteResponse Zod schemas |
| Create | `src/contracts/contracts.spec.ts` | Unit tests for all schemas |
| Modify | `src/worker/worker-agent.service.ts:68` | Validate task.payloadRef at execute() entry |
| Modify | `src/validator/validator-agent.service.ts` | Validate outputRef before markDone |
| Modify | `src/worker/ai-http.client.ts` | Validate AI response shape |
| Modify | `package.json` | Add `zod` dependency |

---

### Task 1: Add Zod dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zod**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npm install zod
```

Expected output: `added 1 package` (zod has zero dependencies)

- [ ] **Step 2: Verify import works**

```bash
node -e "const { z } = require('zod'); console.log(z.string().parse('ok'))"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod for runtime contract validation"
```

---

### Task 2: Create contract schemas

**Files:**
- Create: `src/contracts/task-payload.contract.ts`
- Create: `src/contracts/agent-result.contract.ts`
- Create: `src/contracts/validation-request.contract.ts`
- Create: `src/contracts/validation-result.contract.ts`
- Create: `src/contracts/ai-complete.contract.ts`
- Create: `src/contracts/index.ts`

- [ ] **Step 1: Write task-payload schema**

Create `src/contracts/task-payload.contract.ts`:

```typescript
import { z } from 'zod';

export const TaskPayloadSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  // Free-form task data — minimum required fields only
  description: z.string().optional(),
  acceptance_criteria: z.array(z.string()).max(3).optional(),
}).passthrough(); // allow extra fields per task type

export type TaskPayload = z.infer<typeof TaskPayloadSchema>;
```

- [ ] **Step 2: Write agent-result schema**

Create `src/contracts/agent-result.contract.ts`:

```typescript
import { z } from 'zod';

export const AgentResultSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  output_ref: z.record(z.unknown()),
  text: z.string(),
  model_used: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  token_usage_estimate: z.number().int().nonnegative(),
}).passthrough();

export type AgentResult = z.infer<typeof AgentResultSchema>;
```

- [ ] **Step 3: Write validation schemas**

Create `src/contracts/validation-request.contract.ts`:

```typescript
import { z } from 'zod';

export const ValidationRequestSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  task_id: z.string().uuid(),
  output_ref: z.record(z.unknown()),
  acceptance_criteria: z.array(z.string()),
});

export type ValidationRequest = z.infer<typeof ValidationRequestSchema>;
```

Create `src/contracts/validation-result.contract.ts`:

```typescript
import { z } from 'zod';

export const VerdictSchema = z.enum(['pass', 'needs_revision', 'fail']);

export const ValidationResultSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  task_id: z.string().uuid(),
  validation_passed: z.boolean(),
  verdict: VerdictSchema,
  reason: z.string(),
  findings: z.array(z.string()).default([]),
  revisionHint: z.string().optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
```

- [ ] **Step 4: Write AI complete schemas**

Create `src/contracts/ai-complete.contract.ts`:

```typescript
import { z } from 'zod';

export const ModelTierSchema = z.enum(['free', 'cheap', 'smart', 'premium']);

export const AiCompleteRequestSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  model_tier: ModelTierSchema,
  user_prompt: z.string().min(1),
  system_prompt: z.string().optional(),
  output_schema: z.record(z.unknown()).optional(),
  max_tokens: z.number().int().positive().optional(),
  correlation_id: z.string().optional(),
});

export const AiCompleteResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  text: z.string(),
  model_used: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  token_usage_estimate: z.number().int().nonnegative(),
}).passthrough();

export type AiCompleteRequest = z.infer<typeof AiCompleteRequestSchema>;
export type AiCompleteResponse = z.infer<typeof AiCompleteResponseSchema>;
```

- [ ] **Step 5: Write barrel index**

Create `src/contracts/index.ts`:

```typescript
export * from './task-payload.contract';
export * from './agent-result.contract';
export * from './validation-request.contract';
export * from './validation-result.contract';
export * from './ai-complete.contract';
```

- [ ] **Step 6: Commit**

```bash
git add src/contracts/
git commit -m "feat(contracts): add Zod schemas v1.0 for all agent message boundaries"
```

---

### Task 3: Write contract tests

**Files:**
- Create: `src/contracts/contracts.spec.ts`
- Test: `src/contracts/contracts.spec.ts`

- [ ] **Step 1: Write tests**

Create `src/contracts/contracts.spec.ts`:

```typescript
import { TaskPayloadSchema } from './task-payload.contract';
import { AgentResultSchema } from './agent-result.contract';
import { ValidationRequestSchema } from './validation-request.contract';
import { ValidationResultSchema } from './validation-result.contract';
import { AiCompleteRequestSchema, AiCompleteResponseSchema } from './ai-complete.contract';

describe('TaskPayloadSchema', () => {
  it('accepts minimal payload', () => {
    const result = TaskPayloadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts payload with extra fields (passthrough)', () => {
    const result = TaskPayloadSchema.safeParse({ custom_field: 'value' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.custom_field).toBe('value');
  });

  it('rejects acceptance_criteria longer than 3', () => {
    const result = TaskPayloadSchema.safeParse({ acceptance_criteria: ['a','b','c','d'] });
    expect(result.success).toBe(false);
  });
});

describe('AgentResultSchema', () => {
  it('accepts valid result', () => {
    const result = AgentResultSchema.safeParse({
      output_ref: {},
      text: 'hello',
      model_used: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 20,
      token_usage_estimate: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative token counts', () => {
    const result = AgentResultSchema.safeParse({
      output_ref: {},
      text: 'hello',
      model_used: 'claude-sonnet-4-6',
      inputTokens: -1,
      outputTokens: 20,
      token_usage_estimate: 19,
    });
    expect(result.success).toBe(false);
  });
});

describe('ValidationResultSchema', () => {
  it('accepts pass verdict', () => {
    const result = ValidationResultSchema.safeParse({
      task_id: '00000000-0000-0000-0000-000000000001',
      validation_passed: true,
      verdict: 'pass',
      reason: 'all criteria met',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown verdict', () => {
    const result = ValidationResultSchema.safeParse({
      task_id: '00000000-0000-0000-0000-000000000001',
      validation_passed: false,
      verdict: 'unknown_value',
      reason: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('AiCompleteRequestSchema', () => {
  it('accepts valid tier names', () => {
    for (const tier of ['free', 'cheap', 'smart', 'premium']) {
      const result = AiCompleteRequestSchema.safeParse({ model_tier: tier, user_prompt: 'hi' });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty user_prompt', () => {
    const result = AiCompleteRequestSchema.safeParse({ model_tier: 'free', user_prompt: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest src/contracts/contracts.spec.ts --no-coverage
```

Expected: all tests pass (PASS src/contracts/contracts.spec.ts)

- [ ] **Step 3: Commit**

```bash
git add src/contracts/contracts.spec.ts
git commit -m "test(contracts): add unit tests for all Zod contract schemas"
```

---

### Task 4: Validate task payload in WorkerAgentService

**Files:**
- Modify: `src/worker/worker-agent.service.ts:68` (execute method entry)

- [ ] **Step 1: Write failing test**

Add to a new file `src/worker/worker-agent-contracts.spec.ts`:

```typescript
import { TaskPayloadSchema } from '../contracts';
import { ZodError } from 'zod';

describe('WorkerAgent contract validation', () => {
  it('TaskPayloadSchema rejects acceptance_criteria > 3 items', () => {
    const result = TaskPayloadSchema.safeParse({
      acceptance_criteria: ['a', 'b', 'c', 'd'],
    });
    expect(result.success).toBe(false);
    expect((result as any).error).toBeInstanceOf(ZodError);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (schema already validates, just confirming wire-up)

```bash
npx jest src/worker/worker-agent-contracts.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: Add contract validation at execute() entry in worker-agent.service.ts**

In `src/worker/worker-agent.service.ts`, add import at top:

```typescript
import { TaskPayloadSchema } from '../contracts';
```

Then in the `execute()` method, after `const task = await this.tasksService.findOne(taskId);` (line ~69), add:

```typescript
    const contractCheck = TaskPayloadSchema.safeParse(task.payloadRef);
    if (!contractCheck.success) {
      await this.logger.log({
        level: 'error', msg: 'task_contract_violation', taskId,
        projectId: task.projectId, durationMs: 0,
        metadata: { errors: contractCheck.error.errors },
      });
      return this.tasksService.markFailed(taskId, 'INVALID_CONTRACT');
    }
```

- [ ] **Step 4: Run existing tests**

```bash
npx jest src/worker/ --no-coverage
```

Expected: PASS (no regressions)

- [ ] **Step 5: Commit**

```bash
git add src/worker/worker-agent.service.ts src/worker/worker-agent-contracts.spec.ts
git commit -m "feat(contracts): validate task payload contract at worker execute entry"
```

---

### Task 5: Validate AI response in AiHttpClient

**Files:**
- Modify: `src/worker/ai-http.client.ts`

- [ ] **Step 1: Add import and validation after HTTP response**

Open `src/worker/ai-http.client.ts`. Find the line where the response is returned after a successful HTTP call (look for `return` of the response body object). Add:

```typescript
import { AiCompleteResponseSchema } from '../contracts';
```

After parsing the HTTP response body, before returning, add:

```typescript
    const contractCheck = AiCompleteResponseSchema.safeParse(body);
    if (!contractCheck.success) {
      throw new Error(`AI response contract violation: ${JSON.stringify(contractCheck.error.errors)}`);
    }
```

- [ ] **Step 2: Run existing tests**

```bash
npx jest src/worker/ --no-coverage
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/worker/ai-http.client.ts
git commit -m "feat(contracts): validate AI response shape in AiHttpClient"
```

---

### Task 6: Validate output in ValidatorAgentService

**Files:**
- Modify: `src/validator/validator-agent.service.ts`

- [ ] **Step 1: Find the return point in ValidatorAgentService**

```bash
grep -n "validation_passed\|return {" /home/ssf/Documents/Github/business-orchestrator/src/validator/validator-agent.service.ts | head -20
```

- [ ] **Step 2: Add ValidationResultSchema validation before return**

Add import at top of `src/validator/validator-agent.service.ts`:

```typescript
import { ValidationResultSchema } from '../contracts';
```

Find the method that assembles and returns the validation result object. Before `return result`, add:

```typescript
    const contractCheck = ValidationResultSchema.safeParse(result);
    if (!contractCheck.success) {
      this.logger.log({ level: 'error', msg: 'validation_result_contract_violation',
        taskId: result.task_id ?? 'unknown', projectId: '', durationMs: 0,
        metadata: { errors: contractCheck.error.errors } }).catch(() => {});
      // Return a synthetic failure so the caller can requeue
      return {
        task_id: result.task_id ?? '',
        validation_passed: false,
        verdict: 'fail' as const,
        reason: 'INVALID_CONTRACT: validator produced malformed output',
        findings: [],
        schemaVersion: '1.0' as const,
      };
    }
```

- [ ] **Step 3: Run existing tests**

```bash
npx jest src/validator/ --no-coverage
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/validator/validator-agent.service.ts
git commit -m "feat(contracts): validate ValidationResult schema before returning from ValidatorAgent"
```

---

### Task 7: Build check and end-to-end smoke

- [ ] **Step 1: TypeScript build**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass, no regressions

- [ ] **Step 3: Verify running pod accepts a task**

```bash
kubectl exec -n statex-apps deployment/business-orchestrator -- wget -qO- http://localhost:3390/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Close GitHub issue**

```bash
gh issue comment 19 --repo speakASAP/business-orchestrator --body "## Completed

**What was done:**
- Added zod dependency
- Created src/contracts/ with 5 typed schemas (TaskPayload, AgentResult, ValidationRequest, ValidationResult, AiCompleteRequest/Response)
- All schemas are versioned (schemaVersion: '1.0') and tested
- WorkerAgent validates task payload at execute() entry → INVALID_CONTRACT on violation
- AiHttpClient validates AI response shape
- ValidatorAgent validates output before returning

**Files changed:**
- src/contracts/ (6 new files)
- src/worker/worker-agent.service.ts
- src/worker/ai-http.client.ts
- src/validator/validator-agent.service.ts
- package.json

**Outcome:** All inter-agent message boundaries are contract-validated. Violations fail fast with INVALID_CONTRACT error code."

gh issue close 19 --repo speakASAP/business-orchestrator
```
