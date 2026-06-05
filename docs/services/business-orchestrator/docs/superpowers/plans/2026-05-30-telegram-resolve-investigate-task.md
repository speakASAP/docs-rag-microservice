# Telegram Resolve → AI-Enriched Investigate Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user clicks "Resolve" on a Telegram escalation, capture an optional user note, create an AI-enriched `investigate:*` + `fix:*` task chain (with the note in `user_context`), and block the original failing task on the investigate task until it completes.

**Architecture:** The escalation `resolve()` method in `EscalationsService` fires a new async helper `createInvestigateChainForResolve()` after marking the escalation resolved. This helper reuses `WorkerAgentService.spawnInvestigateFixChainForHumanAck()` (already exists) and then writes the user note into the investigate task's `user_context` via `TasksService.addComment()`. The Telegram note-capture uses a simple in-memory Map (60 s TTL) in `TelegramBotService` — bot replies asking for a note, waits for next message from same chat, then calls resolve.

**Tech Stack:** NestJS, TypeScript, Zod, TypeORM, axios (notifications-microservice side)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/escalations/escalations.service.ts` | `resolve()` fires `createInvestigateChainForResolve()` |
| Modify | `src/escalations/escalations.module.ts` | Import `GoalsModule`, inject `WorkerAgentService` via forwardRef |
| Modify | `src/worker/worker-agent.service.ts` | Expose `spawnInvestigateFixChainForHumanAck` with optional `note` param |
| Modify | `src/tasks/tasks.service.ts` | No changes needed — `addComment` already exists |
| Modify | `src/goals/goals.service.ts` | Add `findOrCreateMaintenanceGoal(projectId)` |
| Modify | `src/goals/goals.module.ts` | Export already present — no change |
| Modify | `src/escalations/escalations.service.spec.ts` | Tests for new resolve behaviour |
| Modify | `notifications-microservice/src/telegram-bot/telegram-bot.service.ts` | Note-capture state machine |
| Modify | `notifications-microservice/src/telegram-bot/orchestrator.client.ts` | Pass `note` to resolve endpoint |
| Modify | `notifications-microservice/src/telegram-bot/telegram-bot.service.spec.ts` | Tests for note flow |

---

## Task 1: Add `findOrCreateMaintenanceGoal` to GoalsService

**Files:**
- Modify: `src/goals/goals.service.ts`
- Test: `src/goals/goals.service.spec.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

In `src/goals/goals.service.spec.ts`, add:

```typescript
describe('findOrCreateMaintenanceGoal', () => {
  it('returns existing maintenance goal if one exists', async () => {
    const existing = { id: 'g1', projectId: 'p1', title: 'Maintenance & Investigations', status: 'active' } as Goal;
    jest.spyOn(service['repo'], 'findOne').mockResolvedValue(existing);
    const result = await service.findOrCreateMaintenanceGoal('p1');
    expect(result).toBe(existing);
    expect(service['repo'].save).not.toHaveBeenCalled();
  });

  it('creates maintenance goal when none exists', async () => {
    const created = { id: 'g2', projectId: 'p1', title: 'Maintenance & Investigations', status: 'active' } as Goal;
    jest.spyOn(service['repo'], 'findOne').mockResolvedValue(null);
    jest.spyOn(service['repo'], 'create').mockReturnValue(created as any);
    jest.spyOn(service['repo'], 'save').mockResolvedValue(created);
    const result = await service.findOrCreateMaintenanceGoal('p1');
    expect(result.title).toBe('Maintenance & Investigations');
    expect(result.id).toBe('g2');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest --testPathPattern="goals.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `findOrCreateMaintenanceGoal is not a function`

- [ ] **Step 3: Implement `findOrCreateMaintenanceGoal`**

In `src/goals/goals.service.ts`, add after the `create()` method:

```typescript
async findOrCreateMaintenanceGoal(projectId: string): Promise<Goal> {
  const existing = await this.repo.findOne({
    where: { projectId, title: 'Maintenance & Investigations' },
  });
  if (existing) return existing;

  const goal = this.repo.create({
    projectId,
    title: 'Maintenance & Investigations',
    description: 'Standing goal for system-generated investigation and fix tasks.',
    constraints: [],
    priority: 5,
    specReference: null,
    planReference: null,
    createdBy: 'system',
    status: 'active',
  });
  const saved = await this.repo.save(goal);
  await this.logger.log({
    level: 'info', msg: 'maintenance_goal_created', projectId, durationMs: 0,
    metadata: { goal_id: saved.id },
  });
  return saved;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx jest --testPathPattern="goals.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/goals/goals.service.ts src/goals/goals.service.spec.ts
git commit -m "feat(goals): add findOrCreateMaintenanceGoal for system-generated tasks"
```

---

## Task 2: Extend `WorkerAgentService.spawnInvestigateFixChainForHumanAck` to accept optional note

**Files:**
- Modify: `src/worker/worker-agent.service.ts` (line ~636)

- [ ] **Step 1: Write the failing test**

In `src/worker/worker-agent.service.spec.ts`, add a test confirming the note is passed through:

```typescript
it('writes user note to investigate task user_context when note provided', async () => {
  const addCommentSpy = jest.spyOn(tasksService, 'addComment').mockResolvedValue({} as any);
  // arrange: tasksService.create returns a task with a known id
  jest.spyOn(tasksService, 'create').mockResolvedValueOnce({ id: 'inv-1', projectId: 'p1', goalId: 'g1' } as any)
    .mockResolvedValueOnce({ id: 'fix-1', projectId: 'p1', goalId: 'g1', blockedBy: [] } as any);
  const failedTask = {
    id: 't1', projectId: 'p1', goalId: 'g1', type: 'code:deploy',
    acceptanceCriteria: ['pass'], payloadRef: {}, codingErrorLog: [], targetService: null,
  } as any;

  await service.spawnInvestigateFixChainForHumanAck(failedTask, 'Check the DB connection first');

  expect(addCommentSpy).toHaveBeenCalledWith('inv-1', 'Check the DB connection first');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --testPathPattern="worker-agent.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — addComment not called

- [ ] **Step 3: Update method signature and implementation**

In `src/worker/worker-agent.service.ts`, change lines ~636–638:

```typescript
async spawnInvestigateFixChainForHumanAck(failedTask: Task, note?: string): Promise<void> {
  const project = { id: failedTask.projectId, slug: failedTask.projectId };
  const investigateTask = await this.spawnInvestigateFixChain(failedTask, project, 'human_acknowledged');
  if (note && investigateTask) {
    await this.tasksService.addComment(investigateTask.id, note).catch((err) => {
      this.logger.log({
        level: 'warn', msg: 'investigate_task_note_failed',
        taskId: failedTask.id, projectId: failedTask.projectId, durationMs: 0,
        metadata: { error: String(err).slice(0, 200) },
      }).catch(() => {});
    });
  }
}
```

Also update `spawnInvestigateFixChain` to **return** the investigate task (currently returns `void`):

Change the private method signature from:
```typescript
private async spawnInvestigateFixChain(
  failedTask: Task,
  project: { id: string; slug: string },
  reason: string,
): Promise<void> {
```

To:
```typescript
private async spawnInvestigateFixChain(
  failedTask: Task,
  project: { id: string; slug: string },
  reason: string,
): Promise<Task | null> {
```

At the end of the `try` block (after logging), add `return investigateTask;`. In the `catch` block, add `return null;` after the logger call.

- [ ] **Step 4: Run to verify it passes**

```bash
npx jest --testPathPattern="worker-agent.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/worker-agent.service.ts src/worker/worker-agent.service.spec.ts
git commit -m "feat(worker): spawnInvestigateFixChainForHumanAck accepts optional user note"
```

---

## Task 3: Extend `EscalationsService.resolve()` to spawn investigate chain

**Files:**
- Modify: `src/escalations/escalations.service.ts`
- Modify: `src/escalations/escalations.module.ts`
- Test: `src/escalations/escalations.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In `src/escalations/escalations.service.spec.ts`, add:

```typescript
describe('resolve with taskId', () => {
  it('spawns investigate chain and passes note when note provided', async () => {
    const escalation = {
      id: 'e1', status: 'open', taskId: 't1', projectId: 'p1',
      subject: 'DB timeout', body: 'Connection refused',
    } as Escalation;
    jest.spyOn(service, 'findOne').mockResolvedValue(escalation);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...escalation, status: 'resolved', resolvedAt: new Date() } as any);
    const spawnSpy = jest.spyOn(workerAgentService, 'spawnInvestigateFixChainForHumanAck').mockResolvedValue(undefined);
    jest.spyOn(tasksService, 'findOne').mockResolvedValue({ id: 't1' } as any);

    await service.resolve('e1', 'Check the Redis config');

    // resolve must complete synchronously
    expect(repo.save).toHaveBeenCalled();
    // chain spawned asynchronously — flush micro-task queue
    await new Promise(r => setImmediate(r));
    expect(spawnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      'Check the Redis config',
    );
  });

  it('resolve succeeds even if spawn fails', async () => {
    const escalation = { id: 'e2', status: 'open', taskId: 't2', projectId: 'p1' } as Escalation;
    jest.spyOn(service, 'findOne').mockResolvedValue(escalation);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...escalation, status: 'resolved' } as any);
    jest.spyOn(tasksService, 'findOne').mockResolvedValue({ id: 't2' } as any);
    jest.spyOn(workerAgentService, 'spawnInvestigateFixChainForHumanAck').mockRejectedValue(new Error('AI down'));

    await expect(service.resolve('e2')).resolves.not.toThrow();
  });

  it('skips spawn when escalation has no taskId', async () => {
    const escalation = { id: 'e3', status: 'open', taskId: null, projectId: 'p1' } as any;
    jest.spyOn(service, 'findOne').mockResolvedValue(escalation);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...escalation, status: 'resolved' } as any);
    const spawnSpy = jest.spyOn(workerAgentService, 'spawnInvestigateFixChainForHumanAck');

    await service.resolve('e3');
    await new Promise(r => setImmediate(r));
    expect(spawnSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --testPathPattern="escalations.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — spawn not called

- [ ] **Step 3: Add `WorkerAgentService` to `EscalationsModule`**

In `src/escalations/escalations.module.ts`, add `GoalsModule` import (for `findOrCreateMaintenanceGoal`) — `WorkerAgentService` is already injected via `forwardRef(() => WorkerModule)`. Verify `WorkerModule` exports `WorkerAgentService`:

```bash
grep -n "exports" /home/ssf/Documents/Github/business-orchestrator/src/worker/worker.module.ts
```

If `WorkerAgentService` is not exported, add it to the `exports` array of `worker.module.ts`.

- [ ] **Step 4: Update `EscalationsService.resolve()`**

Replace the current `resolve()` method:

```typescript
async resolve(id: string, note?: string): Promise<Escalation> {
  const e = await this.findOne(id);
  if (e.status === 'resolved') return e;
  e.status = 'resolved';
  e.resolvedAt = new Date();
  e.resolverNote = note ?? null;
  const saved = await this.repo.save(e);
  await this.logger.log({
    level: 'info', msg: 'escalation_resolved', durationMs: 0,
    metadata: { escalation_id: id, note },
  });

  // Fire-and-forget: spawn investigate+fix chain using existing worker infrastructure
  if (e.taskId) {
    this.triggerInvestigateChainForResolve(e, note).catch((err) => {
      this.logger.log({
        level: 'warn', msg: 'resolve_investigate_spawn_failed',
        taskId: e.taskId, projectId: e.projectId, durationMs: 0,
        metadata: { escalation_id: id, error: String(err).slice(0, 300) },
      }).catch(() => {});
    });
  }

  return saved;
}

private async triggerInvestigateChainForResolve(e: Escalation, note?: string): Promise<void> {
  const task = await this.tasksService.findOne(e.taskId);
  await this.workerAgentService.spawnInvestigateFixChainForHumanAck(task, note);
  await this.logger.log({
    level: 'info', msg: 'resolve_investigate_chain_triggered',
    taskId: e.taskId, projectId: e.projectId, durationMs: 0,
    metadata: { escalation_id: e.id, has_note: !!note },
  });
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
npx jest --testPathPattern="escalations.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/escalations/escalations.service.ts src/escalations/escalations.module.ts src/escalations/escalations.service.spec.ts
git commit -m "feat(escalations): resolve spawns AI investigate+fix chain with optional user note"
```

---

## Task 4: Telegram note-capture state machine (notifications-microservice)

**Files:**
- Modify: `notifications-microservice/src/telegram-bot/telegram-bot.service.ts`
- Modify: `notifications-microservice/src/telegram-bot/orchestrator.client.ts`
- Test: `notifications-microservice/src/telegram-bot/telegram-bot.service.spec.ts`

### How the note-capture works

Telegram inline keyboard buttons cannot open a text input. Instead:
1. User clicks **Resolve** → bot answers the callback with "Resolving… Reply with a note or send `/skip`" and stores `{ escalationId, chatId, expiresAt }` in a `Map<chatId, PendingResolve>`
2. Next message from same chat (within 60 s): if it's `/skip` or blank, note = undefined; otherwise note = message text
3. Bot calls `orchestrator.resolveEscalation(escalationId, note)` and replies with confirmation
4. If 60 s elapses with no message: the pending entry expires; next Resolve click starts fresh

- [ ] **Step 1: Write the failing tests**

In `notifications-microservice/src/telegram-bot/telegram-bot.service.spec.ts` (create if missing):

```typescript
import { TelegramBotService } from './telegram-bot.service';
import { TelegramService } from '../telegram/telegram.service';
import { OrchestratorClient } from './orchestrator.client';

describe('TelegramBotService note-capture', () => {
  let service: TelegramBotService;
  let orchestrator: jest.Mocked<OrchestratorClient>;

  beforeEach(() => {
    orchestrator = { resolveEscalation: jest.fn().mockResolvedValue(undefined), findProjects: jest.fn().mockResolvedValue([]), createGoal: jest.fn(), acknowledgeEscalation: jest.fn(), getRecentTasks: jest.fn().mockResolvedValue([]) } as any;
    const telegram = { send: jest.fn().mockResolvedValue(undefined) } as any;
    service = new TelegramBotService(telegram, orchestrator);
  });

  it('stores pending resolve on esc:resolve: callback and sends prompt', async () => {
    const replySpy = jest.spyOn(service as any, 'reply').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'answerCallbackQuery').mockResolvedValue(undefined);

    await service.handleUpdate({
      update_id: 1,
      callback_query: { id: 'cq1', from: { id: 100, is_bot: false, first_name: 'U' }, data: 'esc:resolve:esc-abc' },
    });

    expect(replySpy).toHaveBeenCalledWith(100, expect.stringContaining('/skip'));
    expect(orchestrator.resolveEscalation).not.toHaveBeenCalled();
  });

  it('resolves with note on next non-skip message', async () => {
    jest.spyOn(service as any, 'reply').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'answerCallbackQuery').mockResolvedValue(undefined);

    // First: click Resolve
    await service.handleUpdate({
      update_id: 1,
      callback_query: { id: 'cq1', from: { id: 100, is_bot: false, first_name: 'U' }, data: 'esc:resolve:esc-abc' },
    });

    // Second: user sends note
    await service.handleUpdate({
      update_id: 2,
      message: { message_id: 1, chat: { id: 100, type: 'private' }, date: Date.now(), text: 'Check Redis config' },
    });

    expect(orchestrator.resolveEscalation).toHaveBeenCalledWith('esc-abc', 'Check Redis config');
  });

  it('resolves without note when /skip sent', async () => {
    jest.spyOn(service as any, 'reply').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'answerCallbackQuery').mockResolvedValue(undefined);

    await service.handleUpdate({
      update_id: 1,
      callback_query: { id: 'cq1', from: { id: 100, is_bot: false, first_name: 'U' }, data: 'esc:resolve:esc-abc' },
    });
    await service.handleUpdate({
      update_id: 2,
      message: { message_id: 2, chat: { id: 100, type: 'private' }, date: Date.now(), text: '/skip' },
    });

    expect(orchestrator.resolveEscalation).toHaveBeenCalledWith('esc-abc', undefined);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /home/ssf/Documents/Github/notifications-microservice
npx jest --testPathPattern="telegram-bot.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: FAIL

- [ ] **Step 3: Add pending-resolve state machine to `TelegramBotService`**

At the top of the class, add:

```typescript
private readonly pendingResolve = new Map<number, { escalationId: string; expiresAt: number }>();
private readonly RESOLVE_NOTE_TIMEOUT_MS = 60_000;
```

Update `handleCallbackQuery` — replace the `esc:resolve:` branch:

```typescript
} else if (data.startsWith('esc:resolve:')) {
  const escalationId = data.slice('esc:resolve:'.length);
  this.pendingResolve.set(chatId, {
    escalationId,
    expiresAt: Date.now() + this.RESOLVE_NOTE_TIMEOUT_MS,
  });
  alertText = 'Add a note below, or send /skip';
  await this.reply(chatId, `Resolving escalation <code>${escalationId}</code>.\n\nReply with a note for the AI (or send <code>/skip</code> to resolve without a note):`);
}
```

Update `handleMessage` — add pending-resolve check **before** the `/status` check:

```typescript
private async handleMessage(chatId: number, text: string): Promise<void> {
  // Check if we're waiting for a resolve note from this chat
  const pending = this.pendingResolve.get(chatId);
  if (pending) {
    this.pendingResolve.delete(chatId);
    if (Date.now() > pending.expiresAt) {
      await this.reply(chatId, 'Resolve timed out. Please click the Resolve button again.');
      return;
    }
    const note = text === '/skip' ? undefined : text;
    try {
      await this.orchestrator.resolveEscalation(pending.escalationId, note);
      await this.reply(chatId, `Escalation resolved.${note ? `\n<i>Note saved: ${note}</i>` : ''}`);
    } catch (err) {
      const status = (err as any)?.response?.status;
      const msg = status === 404 ? 'Escalation not found.' : 'Resolve failed. Please try again.';
      await this.reply(chatId, msg);
    }
    return;
  }

  if (text.startsWith('/status')) { /* ... rest unchanged */ }
  // ... rest of existing handleMessage unchanged
}
```

- [ ] **Step 4: Update `OrchestratorClient.resolveEscalation` to pass note**

The signature already accepts `note?: string` and passes it. Verify:

```bash
grep -n "resolveEscalation" /home/ssf/Documents/Github/notifications-microservice/src/telegram-bot/orchestrator.client.ts
```

Expected output: `async resolveEscalation(id: string, note?: string)` — no change needed if already present.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest --testPathPattern="telegram-bot.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/telegram-bot/telegram-bot.service.ts src/telegram-bot/telegram-bot.service.spec.ts
git commit -m "feat(telegram-bot): two-step resolve flow captures optional user note before resolving"
```

---

## Task 5: TypeScript build verification + full test run

**Files:** No code changes — verification only.

- [ ] **Step 1: Build business-orchestrator**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors

- [ ] **Step 2: Run full test suite for changed modules**

```bash
npx jest --testPathPattern="(escalations|worker-agent|goals\.service)" --no-coverage 2>&1 | tail -30
```

Expected: all PASS

- [ ] **Step 3: Build notifications-microservice**

```bash
cd /home/ssf/Documents/Github/notifications-microservice
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors

- [ ] **Step 4: Run notifications-microservice tests**

```bash
npx jest --testPathPattern="telegram-bot" --no-coverage 2>&1 | tail -20
```

Expected: all PASS

- [ ] **Step 5: Deploy both services**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
./scripts/deploy.sh
```

```bash
cd /home/ssf/Documents/Github/notifications-microservice
./scripts/deploy.sh
```

- [ ] **Step 6: Close issue #9 with completion summary**

```bash
gh issue comment 9 --repo speakASAP/business-orchestrator --body "## Completed

**What was done:**
- Added \`findOrCreateMaintenanceGoal(projectId)\` to GoalsService
- \`spawnInvestigateFixChainForHumanAck\` now accepts optional \`note\` and writes it to investigate task \`user_context\`
- \`EscalationsService.resolve()\` fires investigate+fix chain when escalation has a \`taskId\`
- Telegram Resolve button triggers two-step note-capture flow before calling resolve endpoint
- All failures are swallowed — resolve always succeeds

**Files changed:**
- \`src/goals/goals.service.ts\`
- \`src/worker/worker-agent.service.ts\`
- \`src/escalations/escalations.service.ts\`
- \`notifications-microservice/src/telegram-bot/telegram-bot.service.ts\`

**Outcome:** Deployed to production. Clicking Resolve in Telegram now prompts for a note, creates an AI-enriched investigate+fix task chain, and feeds the note into the task's user_context for the worker agent."

gh issue close 9 --repo speakASAP/business-orchestrator
```
