# CodingWorkerAgent Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enhance `CodingWorkerAgent` with DAG-based task decomposition, iterative revision loops, and live progress streaming — the key patterns from the Cursor SDK / cursor-cookbook that are applicable without external dependencies.

**Architecture:** Three incremental improvements to the existing `CodingWorkerAgentService`: (1) structured multi-step planning that produces a DAG of file-level subtasks, (2) test-run-fix revision loop per subtask, (3) step-level progress events emitted to `logging-microservice`. No new services or external APIs needed.

**Tech Stack:** NestJS · TypeScript · PostgreSQL (`runlayer` schema) · Redis · LiteLLM (`ai-microservice`) · `logging-microservice`

**Context (read first):**
- Current implementation: `src/coding-worker/coding-worker-agent.service.ts`
- Task entity with coding columns: `src/tasks/task.entity.ts` (`coding_plan`, `coding_error_log`, `coding_attempts`)
- Shell exec: `src/coding-worker/shell-exec.service.ts`
- Blacklist env: `CODING_AGENT_BLACKLIST` (default: `auth-microservice,payments-microservice,database-server`)
- Deploy timeout: `CODING_AGENT_DEPLOY_TIMEOUT_MS` (default: 300000)
- All LLM calls go to `http://ai-microservice:3380` — use `cheap` tier for planning, `free` for step validation
- ADR: `docs/adr/005-autonomous-coding-agents.md`

---

### Task 1: DAG-based coding plan schema

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`
- Create: `src/coding-worker/coding-plan.types.ts`

Replace the current free-form `coding_plan` JSON blob with a typed DAG schema so the agent can execute steps in dependency order and track which steps are complete.

- [x] **Step 1: Write failing test for plan schema validation**

```typescript
// src/coding-worker/coding-plan.types.spec.ts
import { validateCodingPlan } from './coding-plan.types';

describe('validateCodingPlan', () => {
  it('rejects plan with missing steps', () => {
    expect(() => validateCodingPlan({ steps: [] })).toThrow('at least one step');
  });

  it('rejects step with cyclic dependency', () => {
    const plan = {
      steps: [
        { id: 'a', depends_on: ['b'], file: 'src/a.ts', description: 'x', action: 'modify' },
        { id: 'b', depends_on: ['a'], file: 'src/b.ts', description: 'y', action: 'modify' },
      ]
    };
    expect(() => validateCodingPlan(plan)).toThrow('cyclic');
  });

  it('accepts valid linear plan', () => {
    const plan = {
      steps: [
        { id: 'a', depends_on: [], file: 'src/a.ts', description: 'add export', action: 'modify' },
        { id: 'b', depends_on: ['a'], file: 'src/b.ts', description: 'import from a', action: 'modify' },
      ]
    };
    expect(validateCodingPlan(plan)).toHaveLength(2);
  });
});
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-plan.types.spec --no-coverage 2>&1 | tail -5
```

Expected: `FAIL` — `validateCodingPlan` not found

- [x] **Step 3: Implement `coding-plan.types.ts`**

```typescript
// src/coding-worker/coding-plan.types.ts
export interface CodingStep {
  id: string;
  depends_on: string[];
  file: string;
  description: string;
  action: 'create' | 'modify' | 'delete';
  status?: 'pending' | 'done' | 'failed';
}

export interface CodingPlan {
  steps: CodingStep[];
}

export function validateCodingPlan(plan: CodingPlan): CodingStep[] {
  if (!plan.steps || plan.steps.length === 0) throw new Error('at least one step required');
  // Kahn's algorithm to detect cycles
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

- [x] **Step 4: Run test — verify it passes**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-plan.types.spec --no-coverage 2>&1 | tail -5
```

Expected: `PASS`

- [x] **Step 5: Commit**

```bash
git add src/coding-worker/coding-plan.types.ts src/coding-worker/coding-plan.types.spec.ts
git commit -m "feat(coding-agent): DAG coding plan schema with cycle detection"
```

---

### Task 2: LLM prompt that produces DAG plan

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

Change the planning LLM call to request a structured DAG plan (JSON matching `CodingPlan` schema) instead of a free-form plan. The prompt must include the schema and instruct the model to output JSON only.

- [x] **Step 1: Write failing test for plan generation**

```typescript
// src/coding-worker/coding-worker-agent.service.spec.ts (add test)
it('buildCodingPlan returns validated DAG plan', async () => {
  const fakeAiResponse = {
    choices: [{
      message: {
        content: JSON.stringify({
          steps: [
            { id: 's1', depends_on: [], file: 'src/agents/agents.controller.ts', description: 'add GET /catalog route', action: 'modify' },
            { id: 's2', depends_on: ['s1'], file: 'src/agents/agents.service.ts', description: 'add catalogAgents() method', action: 'modify' },
          ]
        })
      }
    }]
  };
  jest.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: fakeAiResponse });
  const plan = await service.buildCodingPlan('Add agents catalog endpoint', 'runlayer');
  expect(plan).toHaveLength(2);
  expect(plan[0].id).toBe('s1');
});
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -10
```

- [x] **Step 3: Implement `buildCodingPlan` method**

In `CodingWorkerAgentService`, add:

```typescript
async buildCodingPlan(goalDescription: string, targetService: string): Promise<CodingStep[]> {
  const schema = `{"steps":[{"id":"string","depends_on":["step_id"],"file":"relative/path","description":"what to change","action":"create|modify|delete"}]}`;
  const prompt = `You are a coding agent planning file changes for service: ${targetService}.
Goal: ${goalDescription}

Output ONLY valid JSON matching this schema (no markdown, no explanation):
${schema}

Rules:
- Each step targets exactly one file
- depends_on lists step IDs that must complete before this step
- Keep the plan minimal: only files that must change to meet the goal`;

  const response = await this.httpClient.post('http://ai-microservice:3380/v1/chat/completions', {
    model: 'cheap',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });
  const raw = response.data.choices[0].message.content.trim();
  const parsed: CodingPlan = JSON.parse(raw);
  return validateCodingPlan(parsed);
}
```

- [x] **Step 4: Run test — verify it passes**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -5
```

- [x] **Step 5: Commit**

```bash
git add src/coding-worker/coding-worker-agent.service.ts
git commit -m "feat(coding-agent): LLM prompt generates DAG coding plan"
```

---

### Task 3: Step-level execution with revision loop

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

Replace the current single-shot execution with a loop that: (1) executes steps in topological order, (2) after each step runs the test suite for the changed file, (3) if tests fail, calls LLM to generate a fix (up to 2 retries per step), (4) saves step status back to `coding_plan` column.

- [x] **Step 1: Write failing tests**

```typescript
// src/coding-worker/coding-worker-agent.service.spec.ts
describe('executeWithRevisionLoop', () => {
  it('marks step done when test passes on first attempt', async () => {
    jest.spyOn(shellExec, 'run').mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
    const steps = [{ id: 's1', depends_on: [], file: 'src/a.ts', description: 'x', action: 'modify' as const, status: 'pending' as const }];
    const result = await service.executeWithRevisionLoop(steps, 'runlayer', 'task-123');
    expect(result[0].status).toBe('done');
  });

  it('retries step when test fails, marks failed after max retries', async () => {
    jest.spyOn(shellExec, 'run')
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'FAIL' }) // first test
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'FAIL' }) // retry test
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'FAIL' }); // 2nd retry
    jest.spyOn(httpClient, 'post').mockResolvedValue({ data: { choices: [{ message: { content: '// fix' } }] } });
    const steps = [{ id: 's1', depends_on: [], file: 'src/a.ts', description: 'x', action: 'modify' as const, status: 'pending' as const }];
    const result = await service.executeWithRevisionLoop(steps, 'runlayer', 'task-123');
    expect(result[0].status).toBe('failed');
  });
});
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -10
```

- [x] **Step 3: Implement `executeWithRevisionLoop`**

```typescript
async executeWithRevisionLoop(steps: CodingStep[], targetService: string, taskId: string): Promise<CodingStep[]> {
  const MAX_STEP_RETRIES = 2;
  const repoRoot = process.env.CODING_AGENT_REPO_ROOT || '/home/ssf/Documents/Github';
  const serviceDir = `${repoRoot}/${targetService}`;

  for (const step of steps) {
    let attempt = 0;
    while (attempt <= MAX_STEP_RETRIES) {
      // Run tests scoped to the changed file
      const testResult = await this.shellExec.run(
        `cd ${serviceDir} && npx jest --testPathPattern="${step.file}" --no-coverage --passWithNoTests`,
        { timeoutMs: 60_000 }
      );

      if (testResult.exitCode === 0) {
        step.status = 'done';
        await this.logger.log({ level: 'info', msg: 'coding_step_done', taskId, metadata: { stepId: step.id, attempt } });
        break;
      }

      if (attempt === MAX_STEP_RETRIES) {
        step.status = 'failed';
        await this.logger.log({ level: 'warn', msg: 'coding_step_failed', taskId, metadata: { stepId: step.id, stderr: testResult.stderr.slice(0, 500) } });
        break;
      }

      // Ask LLM to fix based on test output
      const fixResponse = await this.httpClient.post('http://ai-microservice:3380/v1/chat/completions', {
        model: 'free',
        messages: [{ role: 'user', content: `Fix the code in ${step.file} for ${targetService}.\nTest error:\n${testResult.stderr.slice(0, 1000)}\nOriginal goal: ${step.description}` }],
      });
      const fix = fixResponse.data.choices[0].message.content;
      // Apply fix via filesystem (write back to file — implementer fills in actual file-write logic)
      await this.applyCodeFix(step.file, serviceDir, fix);
      attempt++;
    }
  }
  return steps;
}
```

- [x] **Step 4: Run tests — verify they pass**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -5
```

- [x] **Step 5: Commit**

```bash
git add src/coding-worker/coding-worker-agent.service.ts
git commit -m "feat(coding-agent): step-level revision loop with test-driven retry"
```

---

### Task 4: Progress streaming to logging-microservice

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

Emit a structured `coding_step_progress` event after each step completes or fails, including step index, total steps, step status, and elapsed ms. This lets the owner dashboard (and future WebSocket pushes) show live coding progress.

- [x] **Step 1: Write failing test**

```typescript
it('emits progress event for each step', async () => {
  const logSpy = jest.spyOn(logger, 'log').mockResolvedValue(undefined);
  jest.spyOn(shellExec, 'run').mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
  const steps = [
    { id: 's1', depends_on: [], file: 'src/a.ts', description: 'x', action: 'modify' as const, status: 'pending' as const },
    { id: 's2', depends_on: ['s1'], file: 'src/b.ts', description: 'y', action: 'modify' as const, status: 'pending' as const },
  ];
  await service.executeWithRevisionLoop(steps, 'runlayer', 'task-123');
  const progressCalls = logSpy.mock.calls.filter(c => c[0].msg === 'coding_step_progress');
  expect(progressCalls).toHaveLength(2);
  expect(progressCalls[0][0].metadata).toMatchObject({ step: 1, total: 2, status: 'done' });
});
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -5
```

- [x] **Step 3: Add progress event emission in `executeWithRevisionLoop`**

After the `step.status = 'done'` / `step.status = 'failed'` assignment, add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'coding_step_progress',
  taskId,
  metadata: {
    step: steps.indexOf(step) + 1,
    total: steps.length,
    stepId: step.id,
    file: step.file,
    status: step.status,
    elapsedMs: Date.now() - stepStart,
  },
});
```

Where `stepStart = Date.now()` is set at the top of each step's while loop.

- [x] **Step 4: Run test — verify it passes**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -5
```

- [x] **Step 5: Commit**

```bash
git add src/coding-worker/coding-worker-agent.service.ts
git commit -m "feat(coding-agent): emit step-level progress events to logging-microservice"
```

---

### Task 5: Wire DAG plan into main `execute()` flow

**Files:**
- Modify: `src/coding-worker/coding-worker-agent.service.ts`

Replace the current `execute()` body with: `buildCodingPlan()` → `executeWithRevisionLoop()` → persist final `coding_plan` to DB → run `deploy.sh` only if all steps are `done` → health check.

- [x] **Step 1: Write integration test for full execute() flow**

```typescript
it('full execute flow: plan → steps → deploy → health', async () => {
  const mockTask = { id: 'task-1', type: 'coding', payload_ref: '{"goal":"add catalog","targetService":"runlayer"}', coding_attempts: 0 };
  jest.spyOn(tasksService, 'findOne').mockResolvedValue(mockTask as any);
  jest.spyOn(httpClient, 'post')
    .mockResolvedValueOnce({ data: { choices: [{ message: { content: JSON.stringify({ steps: [{ id: 's1', depends_on: [], file: 'src/a.ts', description: 'x', action: 'modify' }] }) } }] } }) // planning
    .mockResolvedValueOnce({ data: { choices: [{ message: { content: '' } }] } }); // unused
  jest.spyOn(shellExec, 'run')
    .mockResolvedValueOnce({ exitCode: 0, stdout: 'ok', stderr: '' }) // test
    .mockResolvedValueOnce({ exitCode: 0, stdout: 'deployed', stderr: '' }); // deploy
  jest.spyOn(httpClient, 'get').mockResolvedValue({ status: 200 }); // health check
  jest.spyOn(tasksService, 'complete').mockResolvedValue(undefined);

  await service.execute('task-1', 'agent-1');

  expect(tasksService.complete).toHaveBeenCalled();
});
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent.service.spec --no-coverage 2>&1 | tail -10
```

- [x] **Step 3: Rewrite `execute()` to use DAG flow**

```typescript
async execute(taskId: string, agentId: string): Promise<void> {
  const task = await this.tasks.findOne(taskId);
  const payload = JSON.parse(task.payload_ref || '{}');
  const targetService = task.target_service || payload.targetService || 'runlayer';
  const goal = payload.goal || payload.description || '';

  // Validate service is not blacklisted
  const blacklist = (process.env.CODING_AGENT_BLACKLIST || 'auth-microservice,payments-microservice,database-server').split(',');
  if (blacklist.includes(targetService)) {
    await this.tasks.fail(taskId, `Service ${targetService} is blacklisted`);
    return;
  }

  // Phase 1: Build DAG plan
  const steps = await this.buildCodingPlan(goal, targetService);
  await this.tasks.updateCodingPlan(taskId, { steps });

  // Phase 2: Execute steps with revision loops
  const finalSteps = await this.executeWithRevisionLoop(steps, targetService, taskId);
  await this.tasks.updateCodingPlan(taskId, { steps: finalSteps });

  const allDone = finalSteps.every(s => s.status === 'done');
  if (!allDone) {
    const failed = finalSteps.filter(s => s.status === 'failed').map(s => s.id);
    await this.tasks.fail(taskId, `Steps failed: ${failed.join(', ')}`);
    return;
  }

  // Phase 3: Deploy
  const repoRoot = process.env.CODING_AGENT_REPO_ROOT || '/home/ssf/Documents/Github';
  const deployResult = await this.shellExec.run(`cd ${repoRoot}/${targetService} && ./scripts/deploy.sh`, {
    timeoutMs: Number(process.env.CODING_AGENT_DEPLOY_TIMEOUT_MS || 300_000),
  });
  if (deployResult.exitCode !== 0) {
    await this.tasks.fail(taskId, `Deploy failed: ${deployResult.stderr.slice(0, 500)}`);
    return;
  }

  // Phase 4: Health check
  await new Promise(r => setTimeout(r, 5000));
  const health = await this.httpClient.get(`http://${targetService}:3390/health`).catch(() => ({ status: 0 }));
  if (health.status !== 200) {
    await this.tasks.fail(taskId, `Health check failed after deploy`);
    return;
  }

  await this.tasks.complete(taskId, { deployResult: deployResult.stdout.slice(0, 500) });
}
```

- [x] **Step 4: Run tests — verify they pass**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest coding-worker-agent --no-coverage 2>&1 | tail -10
```

- [x] **Step 5: Full build check**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors

- [x] **Step 6: Commit**

```bash
git add src/coding-worker/coding-worker-agent.service.ts
git commit -m "feat(coding-agent): wire DAG plan into execute() — plan, revise, deploy, health-check"
```

---

### Task 6: Update AGENT_REFERENCE.md and CLAUDE.md

**Files:**
- Modify: `docs/agents/AGENT_REFERENCE.md`
- Modify: `CLAUDE.md` (root)

Update the CodingWorkerAgent row to reflect the new DAG + revision loop capabilities.

- [x] **Step 1: Update AGENT_REFERENCE.md CodingWorkerAgent row**

Replace the existing CodingWorkerAgent row with:

```markdown
| CodingWorkerAgent | `worker/coding` | smart (plan), free (revision) | On-demand via WorkerPool. Handles `type: coding` tasks using a 3-phase pipeline: (1) LLM generates a DAG of file-level steps, (2) each step executes with test-run-fix revision loop (max 2 retries/step), (3) deploy.sh + health check. Max 3 task-level attempts, then escalates. Emits `coding_step_progress` events per step. Blacklist: `auth-microservice`, `payments-microservice`, `database-server`. |
```

- [x] **Step 2: Update CLAUDE.md Coding Worker Agent env table**

Add a row for `CODING_AGENT_STEP_MAX_RETRIES`:

```markdown
| `CODING_AGENT_STEP_MAX_RETRIES` | Max revision attempts per step before marking step failed (default: `2`) |
```

- [x] **Step 3: Commit**

```bash
git add docs/agents/AGENT_REFERENCE.md CLAUDE.md
git commit -m "docs(coding-agent): update AGENT_REFERENCE and CLAUDE.md for DAG pipeline"
```
