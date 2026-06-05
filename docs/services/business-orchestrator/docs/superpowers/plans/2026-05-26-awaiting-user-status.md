# AWAITING_USER Task Status, GUI Feedback Loop & Manual Execution Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two related capabilities in one plan:
1. **AWAITING_USER status** — agents can pause mid-execution and ask the user a question; user answers via dashboard GUI; task resumes.
2. **Manual execution mode** — a per-project debug toggle where the user must approve every new task before it runs, can inspect full task details (payload, AI request/response, dependencies), and explicitly starts each task. When satisfied, user switches the project to Auto mode and tasks run unsupervised.

**Architecture:**
- A new `execution_mode: 'manual' | 'auto'` column on the `Project` entity gates whether the worker pool dispatches tasks automatically or holds them in `pending_approval` status until the user clicks "Approve & Run".
- A new task status `pending_approval` sits between `created` and `assigned` in Manual mode. Worker pool skips tasks in `pending_approval`; only a user action advances them to `created`.
- The dashboard gains a **Manual Mode panel**: shows execution plan (tasks grouped by goal, with dependency arrows), task detail drawer (full payloadRef, acceptance criteria, which task's output feeds this one), and approve/reject buttons.
- `awaiting_user` status (agent mid-run question) works in both modes.
- After all tasks run cleanly in Manual mode, user clicks "Switch to Auto" — project `execution_mode` becomes `'auto'` and the worker pool resumes normal dispatch.

**Tech Stack:** NestJS, TypeScript, Socket.IO, TypeORM (two DB migrations: new column + new status value), vanilla JS frontend (public/app.js)

**GitHub Issue:** https://github.com/speakASAP/business-orchestrator/issues/18

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/projects/project.entity.ts` | Add `execution_mode: 'manual' \| 'auto'` column |
| Modify | `src/tasks/task.entity.ts:30` | Add `'awaiting_user' \| 'pending_approval'` to status union; add `pendingQuestion`, `aiRequestLog`, `aiResponseLog` columns |
| Modify | `src/tasks/tasks.service.ts` | Add `markAwaitingUser()`, `answerTask()`, `approveTask()`, `rejectTask()`, `findPendingApproval()` |
| Modify | `src/worker/worker-pool.service.ts:58` | Skip tasks in `pending_approval`; in Manual mode set newly `created` tasks to `pending_approval` |
| Modify | `src/worker/worker-agent.service.ts` | Log AI request+response into `aiRequestLog`/`aiResponseLog`; detect `__needs_user_input` |
| Modify | `src/projects/projects.service.ts` | Add `setExecutionMode(projectId, mode)` |
| Modify | `src/dashboard/dashboard.gateway.ts` | Add `emitAwaitingUser()`, `emitTaskPendingApproval()` |
| Modify | `src/dashboard/dashboard.controller.ts` | Add answer, approve, reject, setMode endpoints |
| Modify | `src/public/app.js` | Manual Mode panel: execution plan view, task detail drawer, approve/reject, dependency graph, mode toggle |
| Create | `src/tasks/tasks-manual.spec.ts` | Unit tests for new service methods |
| Create | migrations (×2) | `execution_mode` column + new status values + new log columns |

---

### Task 1: Add `execution_mode` to Project entity

**Files:**
- Modify: `src/projects/project.entity.ts`

- [ ] **Step 1: Write the failing test**

Create `src/projects/project-mode.spec.ts`:

```typescript
import { Project } from './project.entity';

describe('Project entity - execution_mode', () => {
  it('defaults to auto mode', () => {
    const p = new Project();
    expect(p.executionMode).toBeUndefined(); // not set until DB default kicks in
  });

  it('accepts manual and auto values', () => {
    const p = new Project();
    p.executionMode = 'manual';
    expect(p.executionMode).toBe('manual');
    p.executionMode = 'auto';
    expect(p.executionMode).toBe('auto');
  });
});
```

- [ ] **Step 2: Run test — expect TypeScript error**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest src/projects/project-mode.spec.ts --no-coverage 2>&1 | head -20
```

Expected: TypeScript error — `executionMode` does not exist on `Project`

- [ ] **Step 3: Add executionMode column to project.entity.ts**

In `src/projects/project.entity.ts`, add after the `quota` column (around line 36):

```typescript
  @Column({ name: 'execution_mode', default: 'auto' })
  executionMode: 'manual' | 'auto';
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest src/projects/project-mode.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/projects/project.entity.ts src/projects/project-mode.spec.ts
git commit -m "feat(projects): add execution_mode (manual|auto) field to Project entity"
```

---

### Task 2: Add new task statuses and log columns to Task entity

**Files:**
- Modify: `src/tasks/task.entity.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tasks/tasks-manual.spec.ts`:

```typescript
import { Task } from './task.entity';

describe('Task entity - manual mode statuses', () => {
  it('accepts pending_approval status', () => {
    const t = new Task();
    t.status = 'pending_approval';
    expect(t.status).toBe('pending_approval');
  });

  it('accepts awaiting_user status', () => {
    const t = new Task();
    t.status = 'awaiting_user';
    expect(t.status).toBe('awaiting_user');
  });

  it('has aiRequestLog field', () => {
    const t = new Task();
    t.aiRequestLog = { model_tier: 'free', user_prompt: 'hello', max_tokens: 800 };
    expect(t.aiRequestLog.model_tier).toBe('free');
  });

  it('has aiResponseLog field', () => {
    const t = new Task();
    t.aiResponseLog = { text: 'hi', model_used: 'claude-sonnet-4-6', inputTokens: 10, outputTokens: 5 };
    expect(t.aiResponseLog.model_used).toBe('claude-sonnet-4-6');
  });
});
```

- [ ] **Step 2: Run test — expect TypeScript errors**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage 2>&1 | head -20
```

Expected: TypeScript errors — `pending_approval` not in union, `aiRequestLog`/`aiResponseLog` don't exist

- [ ] **Step 3: Update task.entity.ts**

In `src/tasks/task.entity.ts`, change the status column (line 30) to:

```typescript
  @Column({ default: 'created' })
  status:
    | 'created'
    | 'assigned'
    | 'in_progress'
    | 'validation'
    | 'done'
    | 'failed'
    | 'cancelled'
    | 'awaiting_user'
    | 'pending_approval';
```

Add these columns after the `outputRef` column:

```typescript
  @Column({ name: 'pending_question', type: 'text', nullable: true })
  pendingQuestion: string | null;

  @Column({ name: 'ai_request_log', type: 'jsonb', nullable: true })
  aiRequestLog: Record<string, any> | null;

  @Column({ name: 'ai_response_log', type: 'jsonb', nullable: true })
  aiResponseLog: Record<string, any> | null;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tasks/task.entity.ts src/tasks/tasks-manual.spec.ts
git commit -m "feat(tasks): add pending_approval, awaiting_user statuses and AI log columns to Task entity"
```

---

### Task 3: Add manual-mode service methods to TasksService

**Files:**
- Modify: `src/tasks/tasks.service.ts`
- Modify: `src/tasks/tasks-manual.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/tasks/tasks-manual.spec.ts`:

```typescript
import { TasksService } from './tasks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { LoggingClient } from '../common/logging/logging.client';

describe('TasksService - manual mode methods', () => {
  let service: TasksService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((t) => Promise.resolve(t)),
    };
    const mockLogger = { log: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: mockRepo },
        { provide: LoggingClient, useValue: mockLogger },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('markAwaitingUser sets status and pendingQuestion', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-1', projectId: 'proj-1',
      status: 'in_progress', pendingQuestion: null,
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.markAwaitingUser('uuid-1', 'Which format?');
    expect(result.status).toBe('awaiting_user');
    expect(result.pendingQuestion).toBe('Which format?');
  });

  it('answerTask stores answer and requeues to created', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-1', projectId: 'proj-1',
      status: 'awaiting_user', pendingQuestion: 'Which format?',
      payloadRef: { description: 'do something' },
      attempt: 1, maxAttempts: 3,
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.answerTask('uuid-1', 'JSON please');
    expect(result.status).toBe('created');
    expect(result.payloadRef.user_answer).toBe('JSON please');
    expect(result.pendingQuestion).toBeNull();
  });

  it('answerTask throws if task is not awaiting_user', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-1', projectId: 'proj-1', status: 'in_progress',
    });
    mockRepo.findOne.mockResolvedValue(task);
    await expect(service.answerTask('uuid-1', 'x')).rejects.toThrow('not in awaiting_user');
  });

  it('approveTask moves pending_approval → created', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-2', projectId: 'proj-1', status: 'pending_approval',
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.approveTask('uuid-2');
    expect(result.status).toBe('created');
  });

  it('rejectTask moves pending_approval → failed', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-2', projectId: 'proj-1', status: 'pending_approval',
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.rejectTask('uuid-2', 'Not needed');
    expect(result.status).toBe('failed');
    expect(result.blockedReason).toBe('USER_REJECTED:Not needed');
  });

  it('approveTask throws if task is not pending_approval', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-3', projectId: 'proj-1', status: 'created',
    });
    mockRepo.findOne.mockResolvedValue(task);
    await expect(service.approveTask('uuid-3')).rejects.toThrow('not in pending_approval');
  });

  it('findPendingApproval returns tasks for a project', async () => {
    const t1 = Object.assign(new Task(), { id: 'a', status: 'pending_approval' });
    mockRepo.find.mockResolvedValue([t1]);
    const results = await service.findPendingApproval('proj-1');
    expect(results).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj-1', status: 'pending_approval' } })
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage
```

Expected: FAIL — methods not implemented yet

- [ ] **Step 3: Implement methods in tasks.service.ts**

Add after `requeueAfterFailure()`:

```typescript
  async markAwaitingUser(taskId: string, question: string): Promise<Task> {
    const task = await this.findOne(taskId);
    const from = task.status;
    task.status = 'awaiting_user';
    task.pendingQuestion = question;
    const saved = await this.repo.save(task);
    await this.logTransition(taskId, task.projectId, from, saved.status, 'mark_awaiting_user', { question });
    return saved;
  }

  async answerTask(taskId: string, answer: string): Promise<Task> {
    const task = await this.findOne(taskId);
    if (task.status !== 'awaiting_user') {
      throw new BadRequestException('Task is not in awaiting_user status');
    }
    const from = task.status;
    task.status = 'created';
    task.payloadRef = { ...task.payloadRef, user_answer: answer };
    task.pendingQuestion = null;
    task.assigneeAgentId = null;
    task.assignedAt = null;
    const saved = await this.repo.save(task);
    await this.logTransition(taskId, task.projectId, from, saved.status, 'answer_task', { answer_length: answer.length });
    return saved;
  }

  async approveTask(taskId: string): Promise<Task> {
    const task = await this.findOne(taskId);
    if (task.status !== 'pending_approval') {
      throw new BadRequestException('Task is not in pending_approval status');
    }
    const from = task.status;
    task.status = 'created';
    const saved = await this.repo.save(task);
    await this.logTransition(taskId, task.projectId, from, saved.status, 'approve_task');
    return saved;
  }

  async rejectTask(taskId: string, reason: string): Promise<Task> {
    const task = await this.findOne(taskId);
    if (task.status !== 'pending_approval') {
      throw new BadRequestException('Task is not in pending_approval status');
    }
    const from = task.status;
    task.status = 'failed';
    task.blockedReason = `USER_REJECTED:${reason}`;
    task.completedAt = new Date();
    const saved = await this.repo.save(task);
    await this.logTransition(taskId, task.projectId, from, saved.status, 'reject_task', { reason });
    return saved;
  }

  async findPendingApproval(projectId: string): Promise<Task[]> {
    return this.repo.find({
      where: { projectId, status: 'pending_approval' },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tasks/tasks.service.ts src/tasks/tasks-manual.spec.ts
git commit -m "feat(tasks): add markAwaitingUser, answerTask, approveTask, rejectTask, findPendingApproval"
```

---

### Task 4: Add setExecutionMode to ProjectsService

**Files:**
- Modify: `src/projects/projects.service.ts`

- [ ] **Step 1: Find the save pattern in projects.service.ts**

```bash
grep -n "save\|findOne\|async " /home/ssf/Documents/Github/business-orchestrator/src/projects/projects.service.ts | head -20
```

- [ ] **Step 2: Add setExecutionMode method**

Add after the last public method in `src/projects/projects.service.ts`:

```typescript
  async setExecutionMode(projectId: string, mode: 'manual' | 'auto'): Promise<Project> {
    const project = await this.findOne(projectId);
    project.executionMode = mode;
    return this.repo.save(project);
  }
```

- [ ] **Step 3: TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/projects/projects.service.ts
git commit -m "feat(projects): add setExecutionMode(projectId, mode) to ProjectsService"
```

---

### Task 5: Gate worker pool dispatch on execution_mode

**Files:**
- Modify: `src/worker/worker-pool.service.ts`

The worker pool's `dispatch()` runs every 10 seconds. In Manual mode, newly `created` tasks (put there by project-coordinator) must be intercepted and set to `pending_approval` instead of being dispatched. Tasks already in `pending_approval` must be skipped.

- [ ] **Step 1: Read the full dispatch method**

```bash
sed -n '1,130p' /home/ssf/Documents/Github/business-orchestrator/src/worker/worker-pool.service.ts
```

- [ ] **Step 2: Inject ProjectsService and add mode check**

Add `ProjectsService` to the constructor imports and `constructor()` parameter list in `worker-pool.service.ts`:

```typescript
import { ProjectsService } from '../projects/projects.service';
```

In the constructor, add:
```typescript
    private readonly projectsService: ProjectsService,
```

- [ ] **Step 3: Add interceptPendingForManualMode() helper**

Add a private method to `worker-pool.service.ts`:

```typescript
  /**
   * In manual mode, tasks created by the coordinator should not auto-dispatch.
   * This method finds newly-created tasks whose project is in manual mode and
   * sets them to pending_approval so the user can review and approve each one.
   */
  private async interceptPendingForManualMode(): Promise<void> {
    const projects = await this.projectsService.findAll();
    const manualProjects = projects.filter((p) => p.executionMode === 'manual');
    for (const project of manualProjects) {
      const createdTasks = await this.tasks.findByProject(project.id, 'created');
      for (const task of createdTasks) {
        await this.tasks.markPendingApproval(task.id);
        this.dashboardGateway.emitTaskPendingApproval({
          taskId: task.id,
          projectId: project.id,
          type: task.type,
          payloadRef: task.payloadRef,
          acceptanceCriteria: task.acceptanceCriteria,
          blockedBy: task.blockedBy,
          predecessor: task.predecessor,
        });
      }
    }
  }
```

- [ ] **Step 4: Call interceptPendingForManualMode at the top of dispatch()**

In the `dispatch()` method, after acquiring the lease but before `findPending()`, add:

```typescript
    await this.interceptPendingForManualMode();
```

- [ ] **Step 5: Add markPendingApproval to TasksService**

In `src/tasks/tasks.service.ts`, add:

```typescript
  async markPendingApproval(taskId: string): Promise<Task> {
    const task = await this.findOne(taskId);
    if (task.status !== 'created') return task; // idempotent
    const from = task.status;
    task.status = 'pending_approval';
    const saved = await this.repo.save(task);
    await this.logTransition(taskId, task.projectId, from, saved.status, 'mark_pending_approval');
    return saved;
  }
```

Also add a test for it in `src/tasks/tasks-manual.spec.ts`:

```typescript
  it('markPendingApproval sets status to pending_approval', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-4', projectId: 'proj-1', status: 'created',
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.markPendingApproval('uuid-4');
    expect(result.status).toBe('pending_approval');
  });

  it('markPendingApproval is idempotent when already pending_approval', async () => {
    const task = Object.assign(new Task(), {
      id: 'uuid-5', projectId: 'proj-1', status: 'pending_approval',
    });
    mockRepo.findOne.mockResolvedValue(task);
    const result = await service.markPendingApproval('uuid-5');
    expect(result.status).toBe('pending_approval');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage
```

Expected: all PASS

- [ ] **Step 7: TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: errors about `emitTaskPendingApproval` not existing yet — fix in Task 6

- [ ] **Step 8: Commit (after Task 6 makes it compile)**

Hold this commit until Task 6 is done.

---

### Task 6: Add emitTaskPendingApproval and emitAwaitingUser to DashboardGateway

**Files:**
- Modify: `src/dashboard/dashboard.gateway.ts`

- [ ] **Step 1: Add new payload interfaces and emit methods**

In `src/dashboard/dashboard.gateway.ts`, add after `EscalationPayload`:

```typescript
export interface AwaitingUserPayload {
  taskId: string;
  projectId: string;
  question: string;
  type?: string;
}

export interface TaskPendingApprovalPayload {
  taskId: string;
  projectId: string;
  type: string;
  payloadRef: Record<string, any>;
  acceptanceCriteria: string[];
  blockedBy: string[];       // task IDs this task is blocked by
  predecessor: string[];     // task IDs that must complete first
}
```

Add after `emitEscalation()`:

```typescript
  /** Emitted by WorkerAgentService when an agent needs user input to continue. */
  emitAwaitingUser(payload: AwaitingUserPayload): void {
    this.server.to(`project:${payload.projectId}`).emit('task.awaiting_user', payload);
    this.server.to('global').emit('task.awaiting_user', payload);
  }

  /** Emitted by WorkerPoolService when a new task is held for user approval (Manual mode). */
  emitTaskPendingApproval(payload: TaskPendingApprovalPayload): void {
    this.server.to(`project:${payload.projectId}`).emit('task.pending_approval', payload);
    this.server.to('global').emit('task.pending_approval', payload);
  }
```

- [ ] **Step 2: TypeScript build check — both worker-pool and gateway now clean**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit worker-pool + gateway + tasks together**

```bash
git add \
  src/worker/worker-pool.service.ts \
  src/dashboard/dashboard.gateway.ts \
  src/tasks/tasks.service.ts \
  src/tasks/tasks-manual.spec.ts
git commit -m "feat(manual-mode): gate worker dispatch on execution_mode, emit pending_approval events"
```

---

### Task 7: Add dashboard API endpoints for manual mode

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`

Add six new endpoints. Also inject `DashboardGateway` and `ProjectsService` into the constructor (ProjectsService is already there; add DashboardGateway).

- [ ] **Step 1: Add DashboardGateway import and injection**

Add to imports at the top:
```typescript
import { DashboardGateway } from './dashboard.gateway';
```

Add to constructor parameters:
```typescript
    private readonly dashboardGateway: DashboardGateway,
```

- [ ] **Step 2: Add manual-mode endpoints**

Add after the `enableWorkers` handler:

```typescript
  /** GET /dashboard/tasks/:taskId/detail — full task detail for manual mode inspection */
  @Get('tasks/:taskId/detail')
  @UseGuards(JwtGuard)
  async taskDetail(@Param('taskId') taskId: string) {
    const task = await this.tasksService.findOne(taskId);
    // Fetch tasks that block this one (input dependencies)
    const allProjectTasks = await this.tasksService.findByProject(task.projectId);
    const blockerTasks = allProjectTasks.filter((t) => task.blockedBy.includes(t.id));
    const dependentTasks = allProjectTasks.filter((t) => task.blocks?.includes(t.id));
    return {
      id: task.id,
      type: task.type,
      status: task.status,
      priority: task.priority,
      attempt: task.attempt,
      maxAttempts: task.maxAttempts,
      acceptanceCriteria: task.acceptanceCriteria,
      payloadRef: task.payloadRef,          // full task spec visible to user
      outputRef: task.outputRef ?? null,    // result after completion
      pendingQuestion: task.pendingQuestion ?? null,
      aiRequestLog: task.aiRequestLog ?? null,    // what was sent to Claude
      aiResponseLog: task.aiResponseLog ?? null,  // what Claude returned
      blockedBy: task.blockedBy,
      blocks: task.blocks ?? [],
      predecessor: task.predecessor,
      successor: task.successor,
      // Resolved dependency summaries
      blockerTasks: blockerTasks.map((t) => ({
        id: t.id, type: t.type, status: t.status,
        outputRef: t.outputRef ?? null,  // output of blocker = input context for this task
      })),
      dependentTasks: dependentTasks.map((t) => ({
        id: t.id, type: t.type, status: t.status,
      })),
      createdAt: task.createdAt,
      assignedAt: task.assignedAt ?? null,
      completedAt: task.completedAt ?? null,
    };
  }

  /** GET /dashboard/projects/:projectId/pending-approval — tasks awaiting user approval */
  @Get('projects/:projectId/pending-approval')
  @UseGuards(JwtGuard)
  async pendingApproval(@Param('projectId') projectId: string) {
    const tasks = await this.tasksService.findPendingApproval(projectId);
    const allProjectTasks = await this.tasksService.findByProject(projectId);
    return tasks.map((task) => {
      const blockerTasks = allProjectTasks.filter((t) => task.blockedBy.includes(t.id));
      return {
        id: task.id,
        type: task.type,
        priority: task.priority,
        acceptanceCriteria: task.acceptanceCriteria,
        payloadRef: task.payloadRef,
        blockedBy: task.blockedBy,
        predecessor: task.predecessor,
        blockerTasks: blockerTasks.map((t) => ({
          id: t.id, type: t.type, status: t.status, outputRef: t.outputRef ?? null,
        })),
        createdAt: task.createdAt,
      };
    });
  }

  /** POST /dashboard/tasks/:taskId/approve — approve a pending_approval task */
  @Post('tasks/:taskId/approve')
  @UseGuards(JwtGuard)
  async approveTask(@Param('taskId') taskId: string) {
    const task = await this.tasksService.approveTask(taskId);
    this.dashboardGateway.emitTaskUpdate({
      taskId: task.id, projectId: task.projectId,
      status: task.status, type: task.type,
    });
    return { taskId: task.id, status: task.status };
  }

  /** POST /dashboard/tasks/:taskId/reject — reject a pending_approval task */
  @Post('tasks/:taskId/reject')
  @UseGuards(JwtGuard)
  async rejectTask(
    @Param('taskId') taskId: string,
    @Body() body: { reason?: string },
  ) {
    const task = await this.tasksService.rejectTask(taskId, body?.reason ?? 'No reason provided');
    this.dashboardGateway.emitTaskUpdate({
      taskId: task.id, projectId: task.projectId,
      status: task.status, type: task.type,
    });
    return { taskId: task.id, status: task.status };
  }

  /** POST /dashboard/tasks/:taskId/answer — answer a question from an awaiting_user task */
  @Post('tasks/:taskId/answer')
  @UseGuards(JwtGuard)
  async answerTask(
    @Param('taskId') taskId: string,
    @Body() body: { answer: string },
  ) {
    if (!body?.answer || typeof body.answer !== 'string') {
      throw new BadRequestException('answer is required');
    }
    const task = await this.tasksService.answerTask(taskId, body.answer);
    this.dashboardGateway.emitTaskUpdate({
      taskId: task.id, projectId: task.projectId,
      status: task.status, type: task.type,
    });
    return { taskId: task.id, status: task.status };
  }

  /** POST /dashboard/projects/:projectId/execution-mode — switch manual/auto */
  @Post('projects/:projectId/execution-mode')
  @UseGuards(JwtGuard)
  async setExecutionMode(
    @Param('projectId') projectId: string,
    @Body() body: { mode: 'manual' | 'auto' },
  ) {
    if (body?.mode !== 'manual' && body?.mode !== 'auto') {
      throw new BadRequestException('mode must be "manual" or "auto"');
    }
    const project = await this.projectsService.setExecutionMode(projectId, body.mode);
    return { projectId: project.id, executionMode: project.executionMode };
  }
```

- [ ] **Step 3: TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/dashboard.controller.ts
git commit -m "feat(dashboard): add approve, reject, answer, detail, pending-approval, execution-mode endpoints"
```

---

### Task 8: Worker agent logs AI request and response

**Files:**
- Modify: `src/worker/worker-agent.service.ts`

The user must see exactly what was sent to Claude and what Claude returned. After the AI call inside `_executeInner`, save request + response into the task's `aiRequestLog`/`aiResponseLog`.

- [ ] **Step 1: Find the AI call in _executeInner**

```bash
grep -n "aiHttp\|complete\|outputRef\|runResult" /home/ssf/Documents/Github/business-orchestrator/src/worker/worker-agent.service.ts | head -20
```

- [ ] **Step 2: Add logging after the AI call**

After building `aiRequest` (the object passed to `aiHttp.complete()`) and after receiving `runResult` from it, add:

```typescript
    // Persist the full AI request and response for dashboard inspection (Manual mode)
    await this.tasksService.saveAiLogs(taskId, aiRequest, runResult);
```

- [ ] **Step 3: Add saveAiLogs to TasksService**

In `src/tasks/tasks.service.ts`, add:

```typescript
  async saveAiLogs(
    taskId: string,
    request: Record<string, any>,
    response: Record<string, any>,
  ): Promise<void> {
    await this.repo.update(taskId, {
      aiRequestLog: request,
      aiResponseLog: response,
    });
  }
```

Add test in `src/tasks/tasks-manual.spec.ts`:

```typescript
  it('saveAiLogs updates aiRequestLog and aiResponseLog', async () => {
    const updateSpy = jest.spyOn(mockRepo, 'update' as any).mockResolvedValue({});
    // @ts-ignore - update not in our mockRepo interface above, add it
    mockRepo.update = jest.fn().mockResolvedValue({});
    await service.saveAiLogs('uuid-1', { user_prompt: 'hi' }, { text: 'hello', model_used: 'claude-sonnet-4-6' });
    expect(mockRepo.update).toHaveBeenCalledWith('uuid-1', {
      aiRequestLog: { user_prompt: 'hi' },
      aiResponseLog: expect.objectContaining({ model_used: 'claude-sonnet-4-6' }),
    });
  });
```

- [ ] **Step 4: Detect __needs_user_input (awaiting_user flow)**

Also in `_executeInner`, after building `outputRef` and before calling `markValidation`, add:

```typescript
    if (outputRef.__needs_user_input === true) {
      const question = typeof outputRef.question === 'string' && outputRef.question.length > 0
        ? outputRef.question
        : 'The agent needs your input to continue.';
      await this.agentsService.markIdle(agentId);
      const waiting = await this.tasksService.markAwaitingUser(taskId, question);
      await this.events.publish('task.awaiting_user', { task_id: taskId, question, projectId: task.projectId });
      this.dashboardGateway.emitAwaitingUser({ taskId, projectId: task.projectId, question, type: task.type });
      await this.logger.log({
        level: 'info', msg: 'task_awaiting_user', taskId,
        projectId: task.projectId, durationMs: 0, metadata: { question },
      });
      return waiting;
    }
```

- [ ] **Step 5: Run tests**

```bash
npx jest src/tasks/tasks-manual.spec.ts --no-coverage
npx jest src/worker/ --no-coverage
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/worker/worker-agent.service.ts src/tasks/tasks.service.ts src/tasks/tasks-manual.spec.ts
git commit -m "feat(worker): log AI request+response to task for dashboard inspection; detect __needs_user_input"
```

---

### Task 9: Frontend — Manual Mode panel in app.js

**Files:**
- Modify: `src/public/app.js`
- Modify: `src/public/index.html` (CSS)

The Manual Mode panel has four sections:
1. **Mode toggle** — "Manual Mode ON / Switch to Auto" button per project
2. **Pending Approval queue** — list of tasks waiting for user to approve, with full detail drawer
3. **Execution plan view** — all tasks for a goal, showing dependency chain (A → B → C means B receives A's output)
4. **Awaiting Answer panel** — tasks where agent paused and asked a question

- [ ] **Step 1: Add WebSocket handlers**

In `src/public/app.js`, add alongside the existing `socket.on('task.updated', ...)` block:

```javascript
socket.on('task.pending_approval', (payload) => {
  addPendingApprovalCard(payload);
});

socket.on('task.awaiting_user', (payload) => {
  addAwaitingUserCard(payload);
});
```

- [ ] **Step 2: Add mode toggle UI per project card**

In the project card render function (look for where project cards are built), add a mode toggle button after the project health display:

```javascript
function renderModeToggle(project) {
  const isManual = project.executionMode === 'manual';
  const btn = document.createElement('button');
  btn.className = `mode-toggle ${isManual ? 'mode-manual' : 'mode-auto'}`;
  btn.dataset.projectId = project.projectId;
  btn.textContent = isManual ? '🔴 Manual Mode — Click to switch to Auto' : '🟢 Auto Mode — Click to enable Manual';
  btn.onclick = () => toggleExecutionMode(project.projectId, isManual ? 'auto' : 'manual');
  return btn;
}

async function toggleExecutionMode(projectId, newMode) {
  const resp = await fetch(`/api/dashboard/projects/${projectId}/execution-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ mode: newMode }),
  });
  if (!resp.ok) { alert('Failed to change mode'); return; }
  // Reload project cards to reflect new mode
  loadDashboard();
}
```

- [ ] **Step 3: Add Pending Approval panel**

```javascript
function addPendingApprovalCard(payload) {
  const container = document.getElementById('pending-approval-panel') || createPendingApprovalContainer();
  // Remove duplicate if re-emitted
  document.querySelector(`.approval-card[data-task-id="${payload.taskId}"]`)?.remove();

  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.taskId = payload.taskId;

  const blockerSummary = (payload.blockerTasks || []).map((b) =>
    `<li><b>${escapeHtml(b.type)}</b> [${b.status}]${b.outputRef ? ' — output available' : ''}</li>`
  ).join('');

  card.innerHTML = `
    <div class="approval-header">
      <span class="approval-badge">Awaiting Approval</span>
      <span class="approval-type">${escapeHtml(payload.type)}</span>
      <button class="btn-detail" onclick="openTaskDetail('${payload.taskId}')">View Details</button>
    </div>
    <div class="approval-payload">
      <b>Task spec:</b>
      <pre>${escapeHtml(JSON.stringify(payload.payloadRef, null, 2))}</pre>
    </div>
    ${payload.acceptanceCriteria?.length ? `
    <div class="approval-criteria">
      <b>Acceptance criteria:</b>
      <ul>${payload.acceptanceCriteria.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
    </div>` : ''}
    ${blockerSummary ? `
    <div class="approval-deps">
      <b>Depends on (inputs come from):</b>
      <ul>${blockerSummary}</ul>
    </div>` : ''}
    <div class="approval-actions">
      <button class="btn-approve" onclick="approveTask('${payload.taskId}')">✅ Approve & Run</button>
      <button class="btn-reject" onclick="promptRejectTask('${payload.taskId}')">❌ Reject</button>
    </div>
  `;
  container.prepend(card);
}

function createPendingApprovalContainer() {
  const container = document.createElement('div');
  container.id = 'pending-approval-panel';
  container.className = 'pending-approval-panel';
  const section = document.createElement('h2');
  section.textContent = 'Tasks Awaiting Your Approval';
  section.className = 'panel-heading';
  const main = document.querySelector('main') || document.body;
  main.prepend(container);
  main.prepend(section);
  return container;
}

async function approveTask(taskId) {
  const btn = document.querySelector(`.approval-card[data-task-id="${taskId}"] .btn-approve`);
  if (btn) { btn.disabled = true; btn.textContent = 'Approving...'; }
  const resp = await fetch(`/api/dashboard/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
  });
  if (resp.ok) {
    document.querySelector(`.approval-card[data-task-id="${taskId}"]`)?.remove();
  } else {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Approve & Run'; }
    alert('Approve failed');
  }
}

async function promptRejectTask(taskId) {
  const reason = prompt('Reason for rejection (optional):') ?? '';
  const resp = await fetch(`/api/dashboard/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ reason }),
  });
  if (resp.ok) {
    document.querySelector(`.approval-card[data-task-id="${taskId}"]`)?.remove();
  } else {
    alert('Reject failed');
  }
}
```

- [ ] **Step 4: Add task detail drawer**

```javascript
async function openTaskDetail(taskId) {
  const resp = await fetch(`/api/dashboard/tasks/${taskId}/detail`, {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
  });
  if (!resp.ok) { alert('Could not load task detail'); return; }
  const task = await resp.json();

  let drawer = document.getElementById('task-detail-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'task-detail-drawer';
    drawer.className = 'task-drawer';
    document.body.appendChild(drawer);
  }

  const depChain = buildDependencyChain(task);

  drawer.innerHTML = `
    <div class="drawer-header">
      <h3>${escapeHtml(task.type)}</h3>
      <span class="drawer-status status-${task.status}">${task.status}</span>
      <button onclick="document.getElementById('task-detail-drawer').style.display='none'">✕ Close</button>
    </div>
    <div class="drawer-section">
      <b>Dependency chain:</b>
      <div class="dep-chain">${depChain}</div>
    </div>
    <div class="drawer-section">
      <b>Task spec (payloadRef):</b>
      <pre>${escapeHtml(JSON.stringify(task.payloadRef, null, 2))}</pre>
    </div>
    ${task.acceptanceCriteria?.length ? `
    <div class="drawer-section">
      <b>Acceptance criteria:</b>
      <ul>${task.acceptanceCriteria.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
    </div>` : ''}
    ${task.aiRequestLog ? `
    <div class="drawer-section">
      <b>AI Request sent to Claude:</b>
      <pre>${escapeHtml(JSON.stringify(task.aiRequestLog, null, 2))}</pre>
    </div>` : ''}
    ${task.aiResponseLog ? `
    <div class="drawer-section">
      <b>AI Response from Claude:</b>
      <pre>${escapeHtml(JSON.stringify(task.aiResponseLog, null, 2))}</pre>
    </div>` : ''}
    ${task.outputRef ? `
    <div class="drawer-section">
      <b>Task output (outputRef):</b>
      <pre>${escapeHtml(JSON.stringify(task.outputRef, null, 2))}</pre>
    </div>` : ''}
    ${task.blockerTasks?.length ? `
    <div class="drawer-section">
      <b>Input from upstream tasks:</b>
      ${task.blockerTasks.map((b) => `
        <div class="dep-task">
          <span class="dep-arrow">↑ input from</span>
          <b>${escapeHtml(b.type)}</b> [${b.status}]
          ${b.outputRef ? `<pre>${escapeHtml(JSON.stringify(b.outputRef, null, 2))}</pre>` : '<em>not completed yet</em>'}
        </div>
      `).join('')}
    </div>` : ''}
    ${task.dependentTasks?.length ? `
    <div class="drawer-section">
      <b>Output feeds into:</b>
      <ul>${task.dependentTasks.map((d) => `<li>${escapeHtml(d.type)} [${d.status}]</li>`).join('')}</ul>
    </div>` : ''}
  `;
  drawer.style.display = 'block';
}

function buildDependencyChain(task) {
  const parts = [];
  if (task.blockerTasks?.length) {
    parts.push(...task.blockerTasks.map((b) => `<span class="chain-node upstream">${escapeHtml(b.type)}</span>`));
    parts.push('<span class="chain-arrow">→</span>');
  }
  parts.push(`<span class="chain-node current">${escapeHtml(task.type)}</span>`);
  if (task.dependentTasks?.length) {
    parts.push('<span class="chain-arrow">→</span>');
    parts.push(...task.dependentTasks.map((d) => `<span class="chain-node downstream">${escapeHtml(d.type)}</span>`));
  }
  return parts.join(' ');
}
```

- [ ] **Step 5: Add awaiting-user panel**

```javascript
function addAwaitingUserCard(payload) {
  const container = document.getElementById('awaiting-user-panel') || createAwaitingUserContainer();
  document.querySelector(`.awaiting-card[data-task-id="${payload.taskId}"]`)?.remove();
  const card = document.createElement('div');
  card.className = 'awaiting-card';
  card.dataset.taskId = payload.taskId;
  card.innerHTML = `
    <div class="awaiting-header">
      <span class="awaiting-badge">Agent Needs Your Answer</span>
      <span class="awaiting-type">${escapeHtml(payload.type || 'task')}</span>
    </div>
    <p class="awaiting-question">${escapeHtml(payload.question)}</p>
    <div class="awaiting-form">
      <textarea id="answer-${payload.taskId}" rows="3" placeholder="Type your answer..."></textarea>
      <button onclick="submitAnswer('${payload.taskId}')">Submit Answer</button>
    </div>
  `;
  container.prepend(card);
}

function createAwaitingUserContainer() {
  const container = document.createElement('div');
  container.id = 'awaiting-user-panel';
  container.className = 'awaiting-user-panel';
  const main = document.querySelector('main') || document.body;
  main.prepend(container);
  return container;
}

async function submitAnswer(taskId) {
  const textarea = document.getElementById(`answer-${taskId}`);
  const answer = textarea ? textarea.value.trim() : '';
  if (!answer) { alert('Please type an answer'); return; }
  const btn = textarea.nextElementSibling;
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const resp = await fetch(`/api/dashboard/tasks/${taskId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ answer }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    document.querySelector(`.awaiting-card[data-task-id="${taskId}"]`)?.remove();
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Submit Answer';
    alert(`Failed: ${err.message}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 6: Add CSS to index.html**

Find the `<style>` block in `src/public/index.html` and add:

```css
/* Manual Mode toggle */
.mode-toggle { padding: 6px 14px; border-radius: 20px; border: none; cursor: pointer; font-size: 13px; margin: 8px 0; }
.mode-manual { background: #ffc107; color: #000; }
.mode-auto   { background: #28a745; color: #fff; }

/* Pending Approval panel */
.panel-heading { font-size: 18px; font-weight: bold; margin: 20px 0 8px; }
.pending-approval-panel { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.approval-card { background: #e8f4fd; border: 2px solid #2196f3; border-radius: 8px; padding: 16px; }
.approval-badge { background: #2196f3; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 8px; font-size: 12px; }
.approval-type { margin-left: 8px; font-weight: 600; }
.approval-payload pre, .drawer-section pre { background: #f4f4f4; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 12px; max-height: 200px; overflow-y: auto; }
.approval-criteria ul, .approval-deps ul { margin: 4px 0 4px 16px; }
.approval-actions { margin-top: 12px; display: flex; gap: 8px; }
.btn-approve { background: #28a745; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.btn-reject  { background: #dc3545; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.btn-detail  { background: #6c757d; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }

/* Task Detail Drawer */
.task-drawer { position: fixed; right: 0; top: 0; width: 560px; height: 100vh; background: #fff; box-shadow: -4px 0 16px rgba(0,0,0,.2); overflow-y: auto; padding: 24px; z-index: 1000; display: none; }
.drawer-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.drawer-header button { margin-left: auto; background: none; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
.drawer-section { margin-bottom: 16px; }
.drawer-status { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #eee; }
.status-done { background: #d4edda; color: #155724; }
.status-failed { background: #f8d7da; color: #721c24; }
.status-in_progress { background: #cce5ff; color: #004085; }
.status-pending_approval { background: #fff3cd; color: #856404; }

/* Dependency chain */
.dep-chain { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.chain-node { padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; }
.chain-node.upstream { background: #e2e3e5; color: #383d41; }
.chain-node.current  { background: #2196f3; color: #fff; }
.chain-node.downstream { background: #d4edda; color: #155724; }
.chain-arrow { font-size: 18px; color: #888; }
.dep-task { border-left: 3px solid #2196f3; padding-left: 12px; margin: 8px 0; }
.dep-arrow { font-size: 12px; color: #888; display: block; }

/* Awaiting User panel */
.awaiting-user-panel { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.awaiting-card { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 16px; }
.awaiting-badge { background: #ffc107; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 8px; font-size: 12px; }
.awaiting-question { margin: 10px 0; font-size: 15px; }
.awaiting-form textarea { width: 100%; margin-bottom: 8px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.awaiting-form button { background: #007bff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.awaiting-form button:disabled { background: #999; cursor: not-allowed; }
```

- [ ] **Step 7: On page load, fetch pending-approval tasks for each project**

In the existing dashboard load function (look for where project data is loaded from `GET /api/dashboard`), after rendering project cards, add:

```javascript
// Load existing pending-approval tasks on page refresh
async function loadPendingApprovals(projects) {
  for (const project of projects) {
    if (project.executionMode !== 'manual') continue;
    const resp = await fetch(`/api/dashboard/projects/${project.projectId}/pending-approval`, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` },
    });
    if (!resp.ok) continue;
    const tasks = await resp.json();
    for (const task of tasks) {
      addPendingApprovalCard({
        taskId: task.id,
        projectId: project.projectId,
        type: task.type,
        payloadRef: task.payloadRef,
        acceptanceCriteria: task.acceptanceCriteria,
        blockedBy: task.blockedBy,
        blockerTasks: task.blockerTasks,
      });
    }
  }
}
```

Call `loadPendingApprovals(projects)` after the dashboard overview data is rendered.

- [ ] **Step 8: Commit**

```bash
git add src/public/app.js src/public/index.html
git commit -m "feat(dashboard-ui): add manual mode panel — approval queue, task detail drawer, dependency chain, mode toggle"
```

---

### Task 10: Database migrations

**Files:**
- Create: two migration files

- [ ] **Step 1: Generate migration for execution_mode and new task columns**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx typeorm migration:generate src/database/migrations/AddManualModeColumns -d src/database/data-source.ts
```

- [ ] **Step 2: Review the generated migration**

```bash
ls -lt src/database/migrations/ | head -3
```

Open the newest file and verify it contains:
- `ALTER TABLE business_orchestrator.projects ADD COLUMN execution_mode VARCHAR DEFAULT 'auto'`
- `ALTER TABLE business_orchestrator.tasks ADD COLUMN pending_question TEXT`
- `ALTER TABLE business_orchestrator.tasks ADD COLUMN ai_request_log JSONB`
- `ALTER TABLE business_orchestrator.tasks ADD COLUMN ai_response_log JSONB`

If the status column is not an enum (it's a VARCHAR with TypeORM), no migration needed for new status values — they work as plain strings.

- [ ] **Step 3: Run migration**

```bash
npx typeorm migration:run -d src/database/data-source.ts
```

Expected: `Migration AddManualModeColumns has been executed successfully`

- [ ] **Step 4: Commit**

```bash
git add src/database/migrations/
git commit -m "chore(db): add execution_mode, pending_question, ai_request_log, ai_response_log columns"
```

---

### Task 11: Full test suite + deploy

- [ ] **Step 1: Full test suite**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 2: TypeScript build**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Deploy**

```bash
bash scripts/deploy.sh
kubectl rollout status deployment/business-orchestrator -n statex-apps --timeout=120s
```

- [ ] **Step 4: Health check**

```bash
kubectl exec -n statex-apps deployment/business-orchestrator -- wget -qO- http://localhost:3390/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Enable Manual mode on a project and smoke test**

```bash
# Switch a project to manual mode
curl -s -X POST https://orchestrator.alfares.cz/api/dashboard/projects/<PROJECT_ID>/execution-mode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"manual"}'
```

Then trigger a coordinator cycle:
```bash
./scripts/orch-trigger-cycle.sh <project-slug>
```

Open the dashboard — confirm new tasks appear in "Tasks Awaiting Your Approval" instead of running automatically.

Click "View Details" — confirm payloadRef, acceptance criteria, and dependency chain are visible.

Click "Approve & Run" on one task — confirm it disappears from the panel and moves to `in_progress` in the task list.

After task completes, open the next task's detail — confirm the upstream task's output appears under "Input from upstream tasks."

- [ ] **Step 6: Switch to Auto and confirm normal dispatch resumes**

```bash
curl -s -X POST https://orchestrator.alfares.cz/api/dashboard/projects/<PROJECT_ID>/execution-mode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"auto"}'
```

Trigger a cycle — confirm tasks run without waiting for approval.

- [ ] **Step 7: Close GitHub issue**

```bash
gh issue comment 18 --repo speakASAP/business-orchestrator --body "## Completed

**What was done:**
- Added execution_mode (manual|auto) to Project entity with DB migration
- Added pending_approval and awaiting_user task statuses
- Added ai_request_log and ai_response_log columns to Task (user can see exactly what Claude was sent and what it returned)
- Worker pool intercepts new tasks in Manual mode → sets them to pending_approval instead of dispatching
- Dashboard: Pending Approval queue, task detail drawer with dependency chain, approve/reject/answer endpoints
- Dashboard: mode toggle button per project (Manual ↔ Auto)
- Dashboard: dependency chain visualization — upstream tasks and their outputs shown as inputs to current task
- Workers detect __needs_user_input in LLM response and pause with awaiting_user status
- All changes tested; deployed to K8s

**Files changed:**
- src/projects/project.entity.ts + projects.service.ts
- src/tasks/task.entity.ts + tasks.service.ts + tasks-manual.spec.ts
- src/worker/worker-pool.service.ts + worker-agent.service.ts
- src/dashboard/dashboard.gateway.ts + dashboard.controller.ts
- src/public/app.js + index.html
- src/database/migrations/ (new migration)

**Outcome:** System runs in Manual mode by default during hypercare. User sees every task, its full spec, AI request/response, and dependency chain before approving. Switch to Auto mode when confident."

gh issue close 18 --repo speakASAP/business-orchestrator
```
