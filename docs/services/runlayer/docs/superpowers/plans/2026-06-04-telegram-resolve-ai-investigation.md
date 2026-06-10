# Telegram Resolve → AI Investigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks "Resolve" on a Telegram escalation that has no `taskId`, spawn a standalone `investigate:escalation` task so the AI investigates the issue.

**Architecture:** `EscalationsService.resolve()` gains a second AI-trigger branch (`else if e.projectId`) that calls a new `WorkerAgentService.spawnStandaloneInvestigateForEscalation()` method. The Telegram bot (notifications-microservice) is unchanged — it already collects the optional note and calls `POST /api/escalations/:id/resolve`.

**Tech Stack:** NestJS, TypeScript, TypeORM, Zod, Jest

---

## File Map

| File | Change |
|------|--------|
| `src/contracts/spawn-payload.contract.ts` | Add `EscalationInvestigatePayloadSchema` + type |
| `src/worker/worker-agent.service.ts` | Add `spawnStandaloneInvestigateForEscalation(escalation, note?)` (public) |
| `src/worker/worker-agent.service.spec.ts` | Add 2 tests for the new method |
| `src/escalations/escalations.service.ts` | Add `else if (e.projectId)` branch + `triggerStandaloneInvestigateForEscalation` private method |
| `src/escalations/escalations.service.spec.ts` | Update mock + add 3 tests |

---

## Task 1: Add EscalationInvestigatePayloadSchema to contracts

**Files:**
- Modify: `src/contracts/spawn-payload.contract.ts`

- [ ] **Step 1: Read the current file**

```bash
cat src/contracts/spawn-payload.contract.ts
```

Expected: shows `InvestigatePayloadSchema` and `FixPayloadSchema` with their `z.object(...)` definitions.

- [ ] **Step 2: Add the new schema at the end of the file**

Append after the last line of `src/contracts/spawn-payload.contract.ts`:

```typescript
export const EscalationInvestigatePayloadSchema = z.object({
  escalation_id: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  level: z.enum(['warn', 'critical']),
  human_note: z.string().nullable().optional(),
});
export type EscalationInvestigatePayload = z.infer<typeof EscalationInvestigatePayloadSchema>;
```

- [ ] **Step 3: Verify the contracts test still passes**

```bash
npm run test -- --testPathPattern="contracts.spec"
```

Expected: PASS (existing tests are unaffected — the new schema is purely additive).

- [ ] **Step 4: Commit**

```bash
git add src/contracts/spawn-payload.contract.ts
git commit -m "feat(contracts): add EscalationInvestigatePayloadSchema"
```

---

## Task 2: Add spawnStandaloneInvestigateForEscalation to WorkerAgentService

**Files:**
- Modify: `src/worker/worker-agent.service.ts:720-747` (after `spawnInvestigateFixChainForHumanAck`)
- Modify: `src/worker/worker-agent.service.spec.ts`

- [ ] **Step 1: Write the failing tests first**

Open `src/worker/worker-agent.service.spec.ts`. After the existing `describe('WorkerAgentService', ...)` block, add a new top-level describe:

```typescript
describe('WorkerAgentService.spawnStandaloneInvestigateForEscalation', () => {
  let service: WorkerAgentService;
  let mockTasksService: any;
  let mockLogger: any;

  beforeEach(() => {
    mockTasksService = {
      findOne: jest.fn(),
      markInProgress: jest.fn(),
      markValidation: jest.fn(),
      markDone: jest.fn(),
      markFailed: jest.fn(),
      requeueAfterFailure: jest.fn(),
      markAwaitingUser: jest.fn(),
      saveAiLogs: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ id: 'inv-esc-1' }),
      save: jest.fn().mockResolvedValue(undefined),
      addComment: jest.fn().mockResolvedValue({}),
    };
    mockLogger = { log: jest.fn().mockResolvedValue(undefined) };

    service = new WorkerAgentService(
      mockTasksService,
      { markBusy: jest.fn(), markIdle: jest.fn(), recordFailure: jest.fn(), findIdleValidators: jest.fn().mockResolvedValue([]) } as any,
      { start: jest.fn().mockResolvedValue({ id: 'exec-1' }), complete: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'p1', businessId: 'b1', quota: { daily_llm_units: 10000 } }) } as any,
      { checkLlmBudget: jest.fn().mockResolvedValue({ allowed: true }), incrementLlmUsage: jest.fn() } as any,
      { cappedModelTier: jest.fn().mockResolvedValue('free') } as any,
      { call: jest.fn() } as any,
      { route: jest.fn().mockResolvedValue({ routed: false }) } as any,
      { validate: jest.fn() } as any,
      { escalate: jest.fn() } as any,
      mockLogger,
      { publish: jest.fn().mockResolvedValue(undefined) } as any,
      { emitTaskUpdate: jest.fn(), emitAwaitingUser: jest.fn() } as any,
      { get: (k: string) => (k === 'workerPool.timeoutMs' ? 900000 : 3) } as any,
      { fetchContext: jest.fn().mockResolvedValue('') } as any,
    );
  });

  it('creates an investigate:escalation task with correct shape', async () => {
    const escalation = {
      id: 'esc-42',
      projectId: 'proj-abc',
      subject: 'Redis timeout spike',
      body: 'p99 latency exceeded 5s for 10 minutes',
      level: 'warn' as const,
    };

    await service.spawnStandaloneInvestigateForEscalation(escalation as any);

    expect(mockTasksService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'investigate:escalation',
        projectId: 'proj-abc',
        priority: 2,
        maxAttempts: 1,
        idempotencyKey: 'investigate-esc:esc-42',
        payloadRef: expect.objectContaining({
          escalation_id: 'esc-42',
          subject: 'Redis timeout spike',
          body: 'p99 latency exceeded 5s for 10 minutes',
          level: 'warn',
          human_note: null,
        }),
      }),
    );
  });

  it('includes human_note in payloadRef when note is provided', async () => {
    const escalation = {
      id: 'esc-43',
      projectId: 'proj-abc',
      subject: 'Memory leak',
      body: 'Heap grows unbounded',
      level: 'critical' as const,
    };

    await service.spawnStandaloneInvestigateForEscalation(escalation as any, 'Check the image upload handler');

    expect(mockTasksService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadRef: expect.objectContaining({
          human_note: 'Check the image upload handler',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --testPathPattern="worker-agent.service.spec"
```

Expected: FAIL with `TypeError: service.spawnStandaloneInvestigateForEscalation is not a function`.

- [ ] **Step 3: Add the import for EscalationInvestigatePayloadSchema**

In `src/worker/worker-agent.service.ts`, find the line (near line 44):

```typescript
import { InvestigatePayloadSchema, FixPayloadSchema } from '../contracts/spawn-payload.contract';
```

Replace with:

```typescript
import { InvestigatePayloadSchema, FixPayloadSchema, EscalationInvestigatePayloadSchema } from '../contracts/spawn-payload.contract';
```

Also add the `Escalation` entity import near the other entity imports (line ~12 area). Find:

```typescript
import { Task } from '../tasks/task.entity';
import { Project } from '../projects/project.entity';
```

Add after those two lines:

```typescript
import { Escalation } from '../escalations/escalation.entity';
```

- [ ] **Step 4: Add spawnStandaloneInvestigateForEscalation after spawnInvestigateFixChainForHumanAck**

In `src/worker/worker-agent.service.ts`, find the line after the closing `}` of `spawnInvestigateFixChainForHumanAck` (currently ends around line 747). Insert the new method before `private async spawnInvestigateFixChain(`:

```typescript
  async spawnStandaloneInvestigateForEscalation(escalation: Escalation, note?: string): Promise<void> {
    const payload = parseOrThrow(EscalationInvestigatePayloadSchema, {
      escalation_id: escalation.id,
      subject: escalation.subject,
      body: escalation.body,
      level: escalation.level,
      human_note: note ?? null,
    }, 'worker.spawnStandaloneInvestigateForEscalation.payload');

    try {
      await this.tasksService.create({
        projectId: escalation.projectId,
        type: 'investigate:escalation',
        payloadRef: payload,
        acceptanceCriteria: [
          'Identify the root cause of the escalation',
          'Propose concrete remediation steps',
        ],
        priority: 2,
        maxAttempts: 1,
        idempotencyKey: `investigate-esc:${escalation.id}`,
      });
      await this.logger.log({
        level: 'info',
        msg: 'escalation_standalone_investigate_spawned',
        projectId: escalation.projectId,
        durationMs: 0,
        metadata: { escalation_id: escalation.id, has_note: !!note },
      });
    } catch (err) {
      await this.logger.log({
        level: 'warn',
        msg: 'escalation_standalone_investigate_spawn_failed',
        projectId: escalation.projectId,
        durationMs: 0,
        metadata: { escalation_id: escalation.id, error: String(err).slice(0, 300) },
      });
    }
  }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test -- --testPathPattern="worker-agent.service.spec"
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/worker-agent.service.ts src/worker/worker-agent.service.spec.ts
git commit -m "feat(worker): add spawnStandaloneInvestigateForEscalation"
```

---

## Task 3: Wire EscalationsService.resolve() and add tests

**Files:**
- Modify: `src/escalations/escalations.service.ts:119-143`
- Modify: `src/escalations/escalations.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/escalations/escalations.service.spec.ts`. Find the `describe('resolve with taskId', ...)` block (starts around line 121). That block's `mockWorkerService` only mocks `spawnInvestigateFixChainForHumanAck`. **Update** the `mockWorkerService` in that block's `beforeEach` to also include the new method:

```typescript
mockWorkerService = {
  spawnInvestigateFixChainForHumanAck: jest.fn().mockResolvedValue(undefined),
  spawnStandaloneInvestigateForEscalation: jest.fn().mockResolvedValue(undefined),
};
```

Then, after the closing `}` of `describe('resolve with taskId', ...)`, add a new describe block:

```typescript
describe('EscalationsService.resolve — no-taskId paths', () => {
  let service: EscalationsService;
  let mockRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let mockWorkerService: {
    spawnInvestigateFixChainForHumanAck: jest.Mock;
    spawnStandaloneInvestigateForEscalation: jest.Mock;
  };
  let mockLogger: { log: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve({ ...e })),
      create: jest.fn().mockImplementation((e) => e),
    };
    mockWorkerService = {
      spawnInvestigateFixChainForHumanAck: jest.fn().mockResolvedValue(undefined),
      spawnStandaloneInvestigateForEscalation: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationsService,
        { provide: getRepositoryToken(Escalation), useValue: mockRepo },
        { provide: NotificationsClient, useValue: { escalate: jest.fn() } },
        { provide: DashboardGateway, useValue: { emitEscalation: jest.fn() } },
        { provide: LoggingClient, useValue: mockLogger },
        { provide: TasksService, useValue: { findOne: jest.fn(), forceRequeue: jest.fn() } },
        { provide: WorkerAgentService, useValue: mockWorkerService },
      ],
    }).compile();

    service = module.get<EscalationsService>(EscalationsService);
  });

  it('calls spawnStandaloneInvestigateForEscalation when escalation has projectId but no taskId', async () => {
    const escalation = {
      id: 'esc-10', status: 'open', taskId: null, projectId: 'proj-1',
      subject: 'Stall detected', body: 'No tasks in 2h', level: 'warn',
    } as any;
    mockRepo.findOne.mockResolvedValue(escalation);

    await service.resolve('esc-10', 'restart the coordinator');
    await new Promise(r => setImmediate(r));

    expect(mockWorkerService.spawnStandaloneInvestigateForEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'esc-10', projectId: 'proj-1' }),
      'restart the coordinator',
    );
    expect(mockWorkerService.spawnInvestigateFixChainForHumanAck).not.toHaveBeenCalled();
  });

  it('does not call any spawn when escalation has neither taskId nor projectId', async () => {
    const escalation = {
      id: 'esc-11', status: 'open', taskId: null, projectId: null,
      subject: 'Generic alert', body: 'Something is wrong', level: 'warn',
    } as any;
    mockRepo.findOne.mockResolvedValue(escalation);

    await service.resolve('esc-11');
    await new Promise(r => setImmediate(r));

    expect(mockWorkerService.spawnStandaloneInvestigateForEscalation).not.toHaveBeenCalled();
    expect(mockWorkerService.spawnInvestigateFixChainForHumanAck).not.toHaveBeenCalled();
  });

  it('resolve still succeeds when standalone spawn fails', async () => {
    const escalation = {
      id: 'esc-12', status: 'open', taskId: null, projectId: 'proj-1',
      subject: 'Alert', body: 'Body', level: 'warn',
    } as any;
    mockRepo.findOne.mockResolvedValue(escalation);
    mockWorkerService.spawnStandaloneInvestigateForEscalation.mockRejectedValue(new Error('worker down'));

    await expect(service.resolve('esc-12')).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm the new tests fail**

```bash
npm run test -- --testPathPattern="escalations.service.spec"
```

Expected: FAIL — the new `spawnStandaloneInvestigateForEscalation` tests fail because the service doesn't call it yet.

- [ ] **Step 3: Add the no-taskId branch to EscalationsService.resolve()**

In `src/escalations/escalations.service.ts`, find the `resolve()` method (line ~119). Replace the block from `if (e.taskId) {` through the closing `}` at line ~140:

```typescript
    if (e.taskId) {
      this.triggerInvestigateChainForResolve(e, note).catch((err) => {
        this.logger.log({
          level: 'warn', msg: 'resolve_investigate_spawn_failed',
          taskId: e.taskId, projectId: e.projectId, durationMs: 0,
          metadata: { escalation_id: id, error: String(err).slice(0, 300) },
        }).catch(() => {});
      });
    }
```

With:

```typescript
    if (e.taskId) {
      this.triggerInvestigateChainForResolve(e, note).catch((err) => {
        this.logger.log({
          level: 'warn', msg: 'resolve_investigate_spawn_failed',
          taskId: e.taskId, projectId: e.projectId, durationMs: 0,
          metadata: { escalation_id: id, error: String(err).slice(0, 300) },
        }).catch(() => {});
      });
    } else if (e.projectId) {
      this.triggerStandaloneInvestigateForEscalation(e, note).catch((err) => {
        this.logger.log({
          level: 'warn', msg: 'resolve_standalone_investigate_spawn_failed',
          projectId: e.projectId, durationMs: 0,
          metadata: { escalation_id: id, error: String(err).slice(0, 300) },
        }).catch(() => {});
      });
    }
```

- [ ] **Step 4: Add the triggerStandaloneInvestigateForEscalation private method**

In `src/escalations/escalations.service.ts`, after the closing `}` of `triggerInvestigateChainForResolve` (line ~153), add:

```typescript
  private async triggerStandaloneInvestigateForEscalation(e: Escalation, note?: string): Promise<void> {
    await this.workerAgentService.spawnStandaloneInvestigateForEscalation(e, note);
    await this.logger.log({
      level: 'info', msg: 'resolve_standalone_investigate_triggered',
      projectId: e.projectId, durationMs: 0,
      metadata: { escalation_id: e.id, has_note: !!note },
    });
  }
```

- [ ] **Step 5: Run the full escalations spec**

```bash
npm run test -- --testPathPattern="escalations.service.spec"
```

Expected: all tests PASS, including the existing `resolve with taskId` tests and the 3 new ones.

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

Expected: all tests PASS. If any unrelated test fails, investigate before committing.

- [ ] **Step 7: Commit**

```bash
git add src/escalations/escalations.service.ts src/escalations/escalations.service.spec.ts
git commit -m "feat(escalations): spawn standalone investigate task on resolve when no taskId"
```
