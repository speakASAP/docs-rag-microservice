# Task User Context & Manual Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user context annotations (comment thread + AI-injected distilled summary) to tasks, plus a PATCH endpoint for manual field editing, surfaced in a drawer UI and inline on task rows.

**Architecture:** New `user_context` JSONB column on tasks; two new dashboard endpoints (`POST /comment`, `PATCH /:id`); existing `reject`/`retry` endpoints gain optional `comment` field; worker prompt builder injects `user_context.distilled` when non-empty; frontend drawer and task-row UI updated.

**Tech Stack:** NestJS · TypeORM · PostgreSQL (JSONB) · Zod contracts · Vanilla JS frontend (app.js/index.html)

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/tasks/task.entity.ts` |
| Modify | `src/tasks/tasks.service.ts` |
| Modify | `src/tasks/tasks.service.spec.ts` |
| Create | `src/database/migrations/1748650000000-AddUserContextToTasks.ts` |
| Create | `src/dashboard/dto/comment-task.dto.ts` |
| Create | `src/dashboard/dto/patch-task.dto.ts` |
| Modify | `src/dashboard/dto/reject-task.dto.ts` |
| Modify | `src/dashboard/dashboard.controller.ts` |
| Modify | `src/contracts/http-responses.contract.ts` |
| Modify | `src/worker/worker-agent.service.ts` |
| Modify | `public/index.html` |
| Modify | `public/app.js` |

---

## Task 1: DB migration + entity column

**Files:**
- Create: `src/database/migrations/1748650000000-AddUserContextToTasks.ts`
- Modify: `src/tasks/task.entity.ts`

- [ ] **Step 1: Create the migration file**

First, find where existing migrations live (the pattern the project uses):

```bash
find /home/ssf/Documents/Github/runlayer/src -name "*Migration*" -o -name "*migration*" | grep -v node_modules | head -10
```

If no migrations directory exists, create it:

```bash
mkdir -p src/database/migrations
```

Create `src/database/migrations/1748650000000-AddUserContextToTasks.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserContextToTasks1748650000000 implements MigrationInterface {
  name = 'AddUserContextToTasks1748650000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE runlayer.tasks
      ADD COLUMN IF NOT EXISTS user_context JSONB NOT NULL DEFAULT '{"distilled":"","thread":[]}'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE runlayer.tasks
      DROP COLUMN IF EXISTS user_context
    `);
  }
}
```

- [ ] **Step 2: Add entity column to `src/tasks/task.entity.ts`**

After the existing `codingErrorLog` column (around line 103), add:

```typescript
@Column({
  name: 'user_context',
  type: 'jsonb',
  default: '{"distilled":"","thread":[]}',
})
userContext: {
  distilled: string;
  thread: Array<{ ts: string; author: string; text: string }>;
};
```

- [ ] **Step 3: Run the migration against the live DB**

```bash
cd /home/ssf/Documents/Github/runlayer
npx typeorm migration:run -d src/app.module.ts 2>&1 || \
  psql "$DATABASE_URL" -c "ALTER TABLE runlayer.tasks ADD COLUMN IF NOT EXISTS user_context JSONB NOT NULL DEFAULT '{\"distilled\":\"\",\"thread\":[]}';"
```

If `typeorm migration:run` fails (datasource not exported from app.module), run the SQL directly via kubectl:

```bash
kubectl exec -n statex-apps deploy/database-server -- psql -U postgres -d postgres -c \
  "ALTER TABLE runlayer.tasks ADD COLUMN IF NOT EXISTS user_context JSONB NOT NULL DEFAULT '{\"distilled\":\"\",\"thread\":[]}';"
```

- [ ] **Step 4: Verify column exists**

```bash
kubectl exec -n statex-apps deploy/database-server -- psql -U postgres -d postgres -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND table_schema='runlayer' AND column_name='user_context';"
```

Expected: one row showing `user_context | jsonb`.

---

## Task 2: TasksService — addComment + patchTask + preserved reactivation

**Files:**
- Modify: `src/tasks/tasks.service.ts`
- Modify: `src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/tasks/tasks.service.spec.ts` (after the existing `retryTask` describe block):

```typescript
describe('addComment', () => {
  it('appends to thread and updates distilled', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', status: 'pending_approval',
      userContext: { distilled: '', thread: [] },
    };
    mockRepo.findOne.mockResolvedValue(task);
    mockRepo.save.mockImplementation((t: any) => Promise.resolve({ ...t }));

    const result = await service.addComment('t1', 'Please fix the title');

    expect(result.userContext.distilled).toBe('Please fix the title');
    expect(result.userContext.thread).toHaveLength(1);
    expect(result.userContext.thread[0].text).toBe('Please fix the title');
    expect(result.userContext.thread[0].author).toBe('user');
  });

  it('accumulates multiple comments in thread', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', status: 'in_progress',
      userContext: {
        distilled: 'first',
        thread: [{ ts: '2026-01-01T00:00:00.000Z', author: 'user', text: 'first' }],
      },
    };
    mockRepo.findOne.mockResolvedValue(task);
    mockRepo.save.mockImplementation((t: any) => Promise.resolve({ ...t }));

    const result = await service.addComment('t1', 'second');

    expect(result.userContext.thread).toHaveLength(2);
    expect(result.userContext.distilled).toBe('second');
  });
});

describe('patchTask', () => {
  it('updates payloadRef when supplied', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', payloadRef: { old: true },
      acceptanceCriteria: [], priority: 3, maxAttempts: 1,
      userContext: { distilled: '', thread: [] },
    };
    mockRepo.findOne.mockResolvedValue(task);
    mockRepo.save.mockImplementation((t: any) => Promise.resolve({ ...t }));

    const result = await service.patchTask('t1', { payloadRef: { new: true } });

    expect(result.payloadRef).toEqual({ new: true });
  });

  it('rejects acceptanceCriteria with more than 3 items', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', payloadRef: {}, acceptanceCriteria: [],
      priority: 3, maxAttempts: 1, userContext: { distilled: '', thread: [] },
    };
    mockRepo.findOne.mockResolvedValue(task);

    await expect(
      service.patchTask('t1', { acceptanceCriteria: ['a', 'b', 'c', 'd'] }),
    ).rejects.toThrow('acceptance_criteria max 3 items');
  });

  it('updates priority when supplied', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', payloadRef: {}, acceptanceCriteria: [],
      priority: 3, maxAttempts: 1, userContext: { distilled: '', thread: [] },
    };
    mockRepo.findOne.mockResolvedValue(task);
    mockRepo.save.mockImplementation((t: any) => Promise.resolve({ ...t }));

    const result = await service.patchTask('t1', { priority: 1 });

    expect(result.priority).toBe(1);
  });
});

describe('reactivateInPlace preserves user_context', () => {
  it('does not clear userContext on retry', async () => {
    const task: any = {
      id: 't1', projectId: 'p1', status: 'failed', attempt: 1, maxAttempts: 2,
      assigneeAgentId: 'a1', assignedAt: new Date(), completedAt: new Date(),
      outputRef: { done: true }, blockedReason: 'err', codingErrorLog: [],
      codingAttempts: 0, pendingQuestion: null, aiRequestLog: null, aiResponseLog: null,
      userContext: { distilled: 'important note', thread: [{ ts: '2026-01-01T00:00:00.000Z', author: 'user', text: 'important note' }] },
    };
    mockRepo.findOne.mockResolvedValue(task);
    mockRepo.save.mockImplementation((t: any) => Promise.resolve({ ...t }));

    const result = await service.retryTask('t1');

    expect(result.userContext.distilled).toBe('important note');
    expect(result.userContext.thread).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest src/tasks/tasks.service.spec.ts --no-coverage 2>&1 | tail -30
```

Expected: failures on `addComment`, `patchTask`, `reactivateInPlace preserves user_context`.

- [ ] **Step 3: Add `addComment` method to `src/tasks/tasks.service.ts`**

Add after the `rejectTask` method (around line 373):

```typescript
async addComment(taskId: string, text: string): Promise<Task> {
  const task = await this.findOne(taskId);
  const existing = task.userContext ?? { distilled: '', thread: [] };
  task.userContext = {
    distilled: text,
    thread: [...existing.thread, { ts: new Date().toISOString(), author: 'user', text }],
  };
  const saved = await this.repo.save(task);
  await this.logger.log({
    level: 'info', msg: 'task_user_comment_added', taskId, projectId: task.projectId, durationMs: 0,
    metadata: { thread_length: saved.userContext.thread.length },
  });
  return saved;
}
```

- [ ] **Step 4: Add `patchTask` method to `src/tasks/tasks.service.ts`**

Add after `addComment`:

```typescript
async patchTask(
  taskId: string,
  dto: {
    payloadRef?: Record<string, any>;
    acceptanceCriteria?: string[];
    priority?: number;
    maxAttempts?: number;
    userContextDistilled?: string;
  },
): Promise<Task> {
  if (dto.acceptanceCriteria && dto.acceptanceCriteria.length > 3) {
    throw new BadRequestException('acceptance_criteria max 3 items');
  }
  const task = await this.findOne(taskId);
  if (dto.payloadRef !== undefined) task.payloadRef = dto.payloadRef;
  if (dto.acceptanceCriteria !== undefined) task.acceptanceCriteria = dto.acceptanceCriteria;
  if (dto.priority !== undefined) task.priority = dto.priority;
  if (dto.maxAttempts !== undefined) task.maxAttempts = dto.maxAttempts;
  if (dto.userContextDistilled !== undefined) {
    task.userContext = { ...(task.userContext ?? { thread: [] }), distilled: dto.userContextDistilled };
  }
  const saved = await this.repo.save(task);
  await this.logger.log({
    level: 'info', msg: 'task_fields_edited', taskId, projectId: task.projectId, durationMs: 0,
    metadata: { fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined) },
  });
  return saved;
}
```

- [ ] **Step 5: Protect `userContext` in `reactivateInPlace`**

In `reactivateInPlace` (around line 276), `userContext` is NOT assigned so it is already preserved by default — TypeORM only writes the fields you explicitly set. Verify by checking that the method does not set `task.userContext = ...` anywhere. If it does, remove that line. No code change needed if the field is untouched.

- [ ] **Step 6: Run tests and verify they pass**

```bash
npx jest src/tasks/tasks.service.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/tasks/task.entity.ts src/tasks/tasks.service.ts src/tasks/tasks.service.spec.ts src/database/migrations/1748650000000-AddUserContextToTasks.ts
git commit -m "feat(tasks): add user_context column, addComment and patchTask service methods"
```

---

## Task 3: New DTOs + updated RejectTaskDto

**Files:**
- Create: `src/dashboard/dto/comment-task.dto.ts`
- Create: `src/dashboard/dto/patch-task.dto.ts`
- Modify: `src/dashboard/dto/reject-task.dto.ts`

- [ ] **Step 1: Create `comment-task.dto.ts`**

```typescript
// src/dashboard/dto/comment-task.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CommentTaskDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
```

- [ ] **Step 2: Create `patch-task.dto.ts`**

```typescript
// src/dashboard/dto/patch-task.dto.ts
import { IsOptional, IsString, IsArray, ArrayMaxSize, IsInt, Min, Max } from 'class-validator';

export class PatchTaskDto {
  @IsOptional()
  payloadRef?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  acceptanceCriteria?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsString()
  userContextDistilled?: string;
}
```

- [ ] **Step 3: Update `reject-task.dto.ts` to add optional comment**

Replace the entire file content:

```typescript
// src/dashboard/dto/reject-task.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RejectTaskDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/dto/comment-task.dto.ts src/dashboard/dto/patch-task.dto.ts src/dashboard/dto/reject-task.dto.ts
git commit -m "feat(dashboard): add CommentTaskDto, PatchTaskDto, extend RejectTaskDto with optional comment"
```

---

## Task 4: Contracts — add userContext to DashboardTaskDetailSchema

**Files:**
- Modify: `src/contracts/http-responses.contract.ts`

- [ ] **Step 1: Add `userContext` field to `DashboardTaskDetailSchema`**

In `src/contracts/http-responses.contract.ts`, find `DashboardTaskDetailSchema` (around line 87). Add `userContext` after `completedAt`:

```typescript
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
  userContext: z.object({
    distilled: z.string(),
    thread: z.array(z.object({
      ts: z.string(),
      author: z.string(),
      text: z.string(),
    })),
  }).optional(),
});
```

- [ ] **Step 2: Run contract tests**

```bash
npx jest src/contracts --no-coverage 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/contracts/http-responses.contract.ts
git commit -m "feat(contracts): add userContext to DashboardTaskDetailSchema"
```

---

## Task 5: Dashboard controller — new endpoints + updated reject/retry

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Add new imports at the top of `dashboard.controller.ts`**

Find the existing import block. Add:

```typescript
import { Patch } from '@nestjs/common';  // add Patch to existing @nestjs/common import
import { CommentTaskDto } from './dto/comment-task.dto';
import { PatchTaskDto } from './dto/patch-task.dto';
```

The existing `@nestjs/common` import line already has `Controller, Get, Post, Delete, Param, Query, Body, UseGuards` — add `Patch` to it.

- [ ] **Step 2: Update `toTaskDetail()` helper to include `userContext`**

Find `private toTaskDetail(t: any)` (around line 197). Add `userContext` to the returned object:

```typescript
private toTaskDetail(t: any) {
  return {
    id: t.id,
    projectId: t.projectId,
    type: t.type,
    status: t.status,
    priority: t.priority,
    attempt: t.attempt,
    maxAttempts: t.maxAttempts,
    payloadRef: t.payloadRef,
    acceptanceCriteria: t.acceptanceCriteria,
    blockedBy: t.blockedBy,
    predecessor: t.predecessor,
    pendingQuestion: t.pendingQuestion ?? null,
    aiRequestLog: t.aiRequestLog ?? null,
    aiResponseLog: t.aiResponseLog ?? null,
    createdAt: t.createdAt,
    assignedAt: t.assignedAt ?? null,
    completedAt: t.completedAt ?? null,
    userContext: t.userContext ?? { distilled: '', thread: [] },
  };
}
```

- [ ] **Step 3: Update `rejectTask` endpoint to pass optional comment**

Replace the existing `rejectTask` method body:

```typescript
@Post('tasks/:taskId/reject')
@UseGuards(JwtGuard)
async rejectTask(
  @Param('taskId') taskId: string,
  @Body() dto: RejectTaskDto,
) {
  // If caller supplied a separate comment, append it to thread after rejection.
  const task = await this.tasksService.rejectTask(taskId, dto.reason);
  if (dto.comment && dto.comment !== dto.reason) {
    await this.tasksService.addComment(taskId, dto.comment);
  }
  // Always append the rejection reason itself as a comment.
  await this.tasksService.addComment(taskId, `[REJECTED] ${dto.reason}`);
  const updated = await this.tasksService.findOne(taskId);
  this.dashboardGateway.emitTaskUpdate({
    taskId,
    projectId: updated.projectId,
    status: updated.status,
    type: updated.type,
  });
  return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(updated) }, 'dashboard.rejectTask');
}
```

- [ ] **Step 4: Update `retryTask` endpoint to accept optional comment**

Replace the existing `retryTask` method:

```typescript
@Post('tasks/:taskId/retry')
@UseGuards(JwtGuard)
async retryTask(
  @Param('taskId') taskId: string,
  @Body() body: { comment?: string },
) {
  if (body?.comment) {
    await this.tasksService.addComment(taskId, body.comment);
  }
  const task = await this.tasksService.retryTask(taskId, 'user_retry');
  this.dashboardGateway.emitTaskUpdate({
    taskId,
    projectId: task.projectId,
    status: task.status,
    type: task.type,
  });
  return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.retryTask');
}
```

- [ ] **Step 5: Add `POST /tasks/:taskId/comment` endpoint**

Add after the `retryTask` method:

```typescript
@Post('tasks/:taskId/comment')
@UseGuards(JwtGuard)
async commentTask(
  @Param('taskId') taskId: string,
  @Body() dto: CommentTaskDto,
) {
  const task = await this.tasksService.addComment(taskId, dto.text);
  this.dashboardGateway.emitTaskUpdate({
    taskId,
    projectId: task.projectId,
    status: task.status,
    type: task.type,
  });
  return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.commentTask');
}
```

- [ ] **Step 6: Add `PATCH /tasks/:taskId` endpoint**

Add after the `commentTask` method:

```typescript
@Patch('tasks/:taskId')
@UseGuards(JwtGuard)
async patchTask(
  @Param('taskId') taskId: string,
  @Body() dto: PatchTaskDto,
) {
  const task = await this.tasksService.patchTask(taskId, dto);
  this.dashboardGateway.emitTaskUpdate({
    taskId,
    projectId: task.projectId,
    status: task.status,
    type: task.type,
  });
  return parseOrThrow(DashboardApproveResponseSchema, { ok: true, task: this.toTaskDetail(task) }, 'dashboard.patchTask');
}
```

- [ ] **Step 7: Build to check for TypeScript errors**

```bash
cd /home/ssf/Documents/Github/runlayer
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/dashboard/dashboard.controller.ts
git commit -m "feat(dashboard): add comment and patch endpoints, wire reject/retry with optional comment"
```

---

## Task 6: Worker — inject user_context into prompt

**Files:**
- Modify: `src/worker/worker-agent.service.ts`

- [ ] **Step 1: Locate the prompt assembly in `worker-agent.service.ts`**

Around line 189, the worker calls `this.taskRouter.route(...)` passing only `id, type, payloadRef, acceptanceCriteria`. Below that (around line 232), the main prompt is built:

```typescript
userPrompt = `${WORKER_INSTRUCTION}${exploreHint}\n\n${JSON.stringify(taskPayload)}`;
```

- [ ] **Step 2: Pass `userContext` through the route call and inject it into the prompt**

First, update the `taskRouter.route(...)` call to include `userContext` (the router passes it through but doesn't use it — we inject at the worker level):

Find the task loading that populates the task object used in the worker. The `task` variable is loaded earlier in the method (search for `const task = await this.tasksService.findOne`). It already has `task.userContext` from the entity.

Add the user context injection block right before the `userPrompt = ...` line (around line 232):

```typescript
// Build user context block if the user left notes.
let userContextBlock = '';
const uc = (task as any).userContext as { distilled: string; thread: Array<{ ts: string; author: string; text: string }> } | undefined;
if (uc?.distilled) {
  const threadLines = (uc.thread ?? [])
    .map((c) => `[${c.ts.slice(0, 16).replace('T', ' ')}] ${c.author}: ${c.text}`)
    .join('\n');
  userContextBlock = `\n\n=== USER CONTEXT (read carefully — this overrides vague instructions) ===\n${uc.distilled}${threadLines ? `\n\n=== PREVIOUS USER COMMENTS ===\n${threadLines}\n===` : '\n==='}\n`;
}
userPrompt = `${WORKER_INSTRUCTION}${exploreHint}${userContextBlock}\n\n${JSON.stringify(taskPayload)}`;
```

- [ ] **Step 3: Build to check for TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/worker/worker-agent.service.ts
git commit -m "feat(worker): inject user_context into worker prompt when non-empty"
```

---

## Task 7: Frontend — task detail drawer with comment thread + JSON editor

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Update `openTaskDetailDrawer` to render user context thread**

Find the function `openTaskDetailDrawer` (around line 3267 in app.js). Inside the `content.innerHTML = \`...\`` template, add a user context section **before** the payload section (before the line containing `step-log-rich-label` for "Payload"):

Replace:
```javascript
      <div class="task-detail-section task-detail-json">
        <div class="step-log-rich-label" onclick="toggleLogMeta('td-payload')">► Payload (payloadRef)</div>
        <pre class="step-log-meta-block" id="td-payload">${escapeHtml(JSON.stringify(t.payloadRef, null, 2) || '{}')}</pre>
      </div>
```

With:
```javascript
      ${renderUserContextSection(t, taskId)}
      <div class="task-detail-section task-detail-json">
        <div class="step-log-rich-label" onclick="toggleLogMeta('td-payload')">► Payload (payloadRef)</div>
        <pre class="step-log-meta-block" id="td-payload">${escapeHtml(JSON.stringify(t.payloadRef, null, 2) || '{}')}</pre>
      </div>
      <div class="task-detail-section">
        <button type="button" class="btn-sm btn-secondary" onclick="openTaskEditPanel('${escapeHtml(taskId)}')">Edit task fields</button>
      </div>
```

- [ ] **Step 2: Add `renderUserContextSection` helper function**

Add this function near the top of the JS functions section (before `openTaskDetailDrawer`):

```javascript
function renderUserContextSection(t, taskId) {
  const uc = t.userContext || { distilled: '', thread: [] };
  const threadHtml = (uc.thread || []).map((c) =>
    `<div class="user-context-comment"><span class="user-context-ts">${escapeHtml(c.ts ? c.ts.slice(0, 16).replace('T', ' ') : '')}</span> <span class="user-context-author">${escapeHtml(c.author)}</span>: ${escapeHtml(c.text)}</div>`
  ).join('');
  const distilledHtml = uc.distilled
    ? `<div class="user-context-distilled"><strong>AI sees:</strong> ${escapeHtml(uc.distilled)}</div>`
    : '';
  return `
    <div class="task-detail-section">
      <strong>User Context</strong>
      ${distilledHtml}
      <div class="user-context-thread" id="user-context-thread-${escapeHtml(taskId)}">${threadHtml || '<em style="color:#94a3b8;font-size:0.8rem">No comments yet</em>'}</div>
      <div style="margin-top:8px;display:flex;gap:6px;align-items:flex-start">
        <textarea id="user-context-input-${escapeHtml(taskId)}" rows="2" placeholder="Add a comment for the AI…" style="flex:1;font-size:0.82rem;padding:4px 6px;border:1px solid #e2e8f0;border-radius:4px;resize:vertical"></textarea>
        <button type="button" class="btn-sm btn-primary" onclick="submitTaskComment('${escapeHtml(taskId)}')">Add</button>
      </div>
      <div id="user-context-status-${escapeHtml(taskId)}" class="form-status"></div>
    </div>`;
}
```

- [ ] **Step 3: Add `submitTaskComment` function**

Add after `renderUserContextSection`:

```javascript
async function submitTaskComment(taskId) {
  const input = document.getElementById(`user-context-input-${taskId}`);
  const statusEl = document.getElementById(`user-context-status-${taskId}`);
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  try {
    if (statusEl) statusEl.textContent = 'Saving…';
    await apiRequest(`/api/dashboard/tasks/${taskId}/comment`, 'POST', { text }, true);
    input.value = '';
    if (statusEl) statusEl.textContent = 'Comment saved.';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    // Re-open drawer to refresh thread.
    await openTaskDetailDrawer(taskId);
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}
```

- [ ] **Step 4: Add `openTaskEditPanel` and `submitTaskPatch` functions**

Add after `submitTaskComment`:

```javascript
async function openTaskEditPanel(taskId) {
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  if (!token) return;
  const t = await apiRequest(`/api/dashboard/tasks/${taskId}/detail`, 'GET', undefined, true);
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = `task-edit-modal-${taskId}`;
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="document.getElementById('task-edit-modal-${escapeHtml(taskId)}').remove()"></div>
    <div class="modal-content" style="max-width:680px;max-height:90vh;overflow-y:auto">
      <h2>Edit task fields</h2>
      <label>Payload (payloadRef) — JSON
        <textarea id="te-payload-${escapeHtml(taskId)}" rows="10" style="font-family:monospace;font-size:0.8rem">${escapeHtml(JSON.stringify(t.payloadRef, null, 2))}</textarea>
      </label>
      <label>Acceptance criteria (one per line, max 3)
        <textarea id="te-criteria-${escapeHtml(taskId)}" rows="3">${escapeHtml((t.acceptanceCriteria || []).join('\n'))}</textarea>
      </label>
      <label>Priority (1=highest, 5=lowest)
        <select id="te-priority-${escapeHtml(taskId)}">
          ${[1,2,3,4,5].map((n) => `<option value="${n}" ${t.priority === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>
      <label>Max attempts
        <input type="number" id="te-maxattempts-${escapeHtml(taskId)}" min="1" value="${t.maxAttempts ?? 1}" style="width:80px">
      </label>
      <label>User context (distilled — what AI sees)
        <textarea id="te-distilled-${escapeHtml(taskId)}" rows="2">${escapeHtml(t.userContext?.distilled || '')}</textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn-primary" onclick="submitTaskPatch('${escapeHtml(taskId)}')">Save changes</button>
        <button type="button" class="btn-secondary" onclick="document.getElementById('task-edit-modal-${escapeHtml(taskId)}').remove()">Cancel</button>
      </div>
      <div id="te-status-${escapeHtml(taskId)}" class="form-status"></div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitTaskPatch(taskId) {
  const statusEl = document.getElementById(`te-status-${taskId}`);
  try {
    const payloadRaw = document.getElementById(`te-payload-${taskId}`)?.value || '{}';
    let payloadRef;
    try { payloadRef = JSON.parse(payloadRaw); } catch { throw new Error('Payload is not valid JSON'); }
    const criteriaRaw = document.getElementById(`te-criteria-${taskId}`)?.value || '';
    const acceptanceCriteria = criteriaRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    const priority = parseInt(document.getElementById(`te-priority-${taskId}`)?.value || '3', 10);
    const maxAttempts = parseInt(document.getElementById(`te-maxattempts-${taskId}`)?.value || '1', 10);
    const userContextDistilled = document.getElementById(`te-distilled-${taskId}`)?.value || '';
    if (statusEl) statusEl.textContent = 'Saving…';
    await apiRequest(`/api/dashboard/tasks/${taskId}`, 'PATCH', {
      payloadRef, acceptanceCriteria, priority, maxAttempts,
      ...(userContextDistilled ? { userContextDistilled } : {}),
    }, true);
    document.getElementById(`task-edit-modal-${taskId}`)?.remove();
    showNotification('Task fields updated');
    await openTaskDetailDrawer(taskId);
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}
```

- [ ] **Step 5: Add inline comment button to every task row**

Find the task row rendering that contains:
```javascript
<button type="button" class="btn-sm btn-secondary" onclick="openTaskDetailDrawer('${escapeHtml(t.id)}')">Details</button>
```

Add a comment button right after it:
```javascript
<button type="button" class="btn-sm btn-secondary" onclick="openInlineCommentModal('${escapeHtml(t.id)}')">💬</button>
```

- [ ] **Step 6: Add `openInlineCommentModal` function**

Add after `submitTaskPatch`:

```javascript
function openInlineCommentModal(taskId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = `inline-comment-modal-${taskId}`;
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="document.getElementById('inline-comment-modal-${escapeHtml(taskId)}').remove()"></div>
    <div class="modal-content" style="max-width:480px">
      <h2>Add comment</h2>
      <label>Comment (will be saved to AI context)
        <textarea id="icm-text-${escapeHtml(taskId)}" rows="4" placeholder="Your note for the AI…"></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn-primary" onclick="submitInlineComment('${escapeHtml(taskId)}')">Save comment</button>
        <button type="button" class="btn-secondary" onclick="document.getElementById('inline-comment-modal-${escapeHtml(taskId)}').remove()">Cancel</button>
      </div>
      <div id="icm-status-${escapeHtml(taskId)}" class="form-status"></div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitInlineComment(taskId) {
  const text = document.getElementById(`icm-text-${taskId}`)?.value?.trim();
  const statusEl = document.getElementById(`icm-status-${taskId}`);
  if (!text) return;
  try {
    if (statusEl) statusEl.textContent = 'Saving…';
    await apiRequest(`/api/dashboard/tasks/${taskId}/comment`, 'POST', { text }, true);
    document.getElementById(`inline-comment-modal-${taskId}`)?.remove();
    showNotification('Comment saved');
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}
```

- [ ] **Step 7: Update reject modal to auto-save comment (default checked)**

Find the reject flow in `pendingApprovalModal` or wherever `rejectTask` is called from the UI. Add a checkbox to the reject reason form that passes the reason as comment. 

Find the HTML for the `pending-approval-modal` rejection form (around line 269 in index.html) and the inline approval/rejection in app.js. The reject submission calls:

```javascript
await apiRequest(`/api/dashboard/tasks/${taskId}/reject`, 'POST', { reason }, true);
```

Update this call to also pass `comment: reason` (the backend will always append a `[REJECTED]` thread entry; the checkbox controls whether an extra copy is added):

```javascript
await apiRequest(`/api/dashboard/tasks/${taskId}/reject`, 'POST', { reason, comment: reason }, true);
```

This means the rejection reason always lands in the thread. No extra checkbox needed — the backend deduplicates by checking `dto.comment !== dto.reason`.

- [ ] **Step 8: Update retry button to support "Add note" split**

Find where `retryTask` is called from the task detail drawer (around line 3285 in app.js):

```javascript
${['failed', 'done'].includes(t.status) && !(t.type === 'plan' && t.status === 'done') ? `<div class="task-approval-actions"><button type="button" class="btn-primary" onclick="retryTask('${escapeHtml(taskId)}')">Retry task</button></div>` : ''}
```

Replace with:
```javascript
${['failed', 'done'].includes(t.status) && !(t.type === 'plan' && t.status === 'done') ? `<div class="task-approval-actions" style="display:flex;gap:6px">
  <button type="button" class="btn-primary" onclick="retryTask('${escapeHtml(taskId)}')">Retry task</button>
  <button type="button" class="btn-secondary" onclick="openRetryWithNoteModal('${escapeHtml(taskId)}')">+ Note before retry</button>
</div>` : ''}
```

Add the `openRetryWithNoteModal` function near `retryTask`:

```javascript
function openRetryWithNoteModal(taskId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = `retry-note-modal-${taskId}`;
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="document.getElementById('retry-note-modal-${escapeHtml(taskId)}').remove()"></div>
    <div class="modal-content" style="max-width:480px">
      <h2>Add note before retry</h2>
      <label>Note for the AI
        <textarea id="rn-text-${escapeHtml(taskId)}" rows="4" placeholder="What should the AI do differently?"></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn-primary" onclick="submitRetryWithNote('${escapeHtml(taskId)}')">Save & retry</button>
        <button type="button" class="btn-secondary" onclick="document.getElementById('retry-note-modal-${escapeHtml(taskId)}').remove()">Cancel</button>
      </div>
      <div id="rn-status-${escapeHtml(taskId)}" class="form-status"></div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitRetryWithNote(taskId) {
  const text = document.getElementById(`rn-text-${taskId}`)?.value?.trim();
  const statusEl = document.getElementById(`rn-status-${taskId}`);
  try {
    if (statusEl) statusEl.textContent = 'Saving…';
    await apiRequest(`/api/dashboard/tasks/${taskId}/retry`, 'POST', { comment: text || undefined }, true);
    document.getElementById(`retry-note-modal-${taskId}`)?.remove();
    showNotification('Note saved — task queued for retry');
    closeTaskDetailDrawer();
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat(ui): task comment thread, inline comment button, JSON edit panel, retry-with-note"
```

---

## Task 8: Add CSS for user context UI

**Files:**
- Modify: `public/style.css` (or wherever app styles live)

- [ ] **Step 1: Find the CSS file**

```bash
ls /home/ssf/Documents/Github/runlayer/public/
```

- [ ] **Step 2: Add user context styles**

Append to the CSS file:

```css
/* User context comment thread */
.user-context-thread { margin: 6px 0; display: flex; flex-direction: column; gap: 4px; }
.user-context-comment { font-size: 0.8rem; background: #f8fafc; border-left: 3px solid #6366f1; padding: 4px 8px; border-radius: 0 4px 4px 0; }
.user-context-ts { color: #94a3b8; font-size: 0.75rem; }
.user-context-author { color: #6366f1; font-weight: 600; }
.user-context-distilled { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 6px 10px; font-size: 0.82rem; margin-bottom: 6px; color: #1e40af; }
```

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat(ui): add user context comment thread styles"
```

---

## Task 9: Deploy and smoke-test

- [ ] **Step 1: Deploy**

```bash
cd /home/ssf/Documents/Github/runlayer
./scripts/deploy.sh
```

- [ ] **Step 2: Verify column exists in production DB**

```bash
kubectl exec -n statex-apps deploy/database-server -- psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND table_schema='runlayer' AND column_name='user_context';"
```

- [ ] **Step 3: Smoke-test via API**

Pick a real task ID from the dashboard, then:

```bash
# Add a comment
curl -s -X POST https://runlayer.alfares.cz/api/dashboard/tasks/<TASK_ID>/comment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"test comment from smoke test"}' | jq '.task.userContext'

# Patch priority
curl -s -X PATCH https://runlayer.alfares.cz/api/dashboard/tasks/<TASK_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority":2}' | jq '.task.priority'
```

Expected: `userContext.thread` has one entry with your text; priority returns `2`.

- [ ] **Step 4: Open task detail drawer in the browser**

Navigate to `https://runlayer.alfares.cz/tasks`, click "Details" on any task.
- Verify "User Context" section appears.
- Add a comment — verify it appears in the thread.
- Click "Edit task fields" — verify JSON editor opens, edit payloadRef, save — verify it persists.
- Verify `💬` button appears on task rows in the task list.
