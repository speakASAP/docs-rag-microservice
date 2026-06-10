# Task Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the user full visibility into why tasks are stuck — agent pool health banner, per-task step logs (including full AI prompts/responses), and a one-click worker re-enable button.

**Architecture:** The logging-microservice gains `task_id` and `project_id` query filters. runlayer emits structured step logs (with full AI payloads in metadata) from worker-pool, worker-agent, and coordinator. The dashboard queries logs via an orchestrator proxy and renders them as a step-log timeline per task, plus an agent health banner.

**Tech Stack:** NestJS, TypeScript, Winston (logging-microservice), class-validator, Axios, vanilla JS dashboard

---

## Critical Bug Found During Research

The logging-microservice uses `forbidNonWhitelisted: true` and expects field `message`, but runlayer sends `msg` (not `message`) plus extra root fields (`task_id`, `project_id`, etc.) that aren't in the DTO. **All orchestrator logs are currently silently rejected.** Task 1 fixes this first.

---

## File Map

| Service | File | Action |
|---------|------|--------|
| logging-microservice | `src/logs/dto/log-entry.dto.ts` | Add `task_id`, `project_id`, `msg`, `task_id` root fields; keep `message` optional alias |
| logging-microservice | `src/logs/logs.service.ts` | Add `task_id` and `project_id` filters to `query()` |
| logging-microservice | `src/logs/logs.controller.ts` | Add `task_id` and `project_id` query params |
| runlayer | `src/common/logging/logging.client.ts` | Add `projectId` to POST body root (already has `task_id`) — verify field name is `message` not `msg` |
| runlayer | `src/worker/worker-pool.service.ts` | Replace console.log with structured logger; log agent counts per type/status on every tick |
| runlayer | `src/worker/worker-agent.service.ts` | Add step logs: budget, AI call start/end (full prompt+response in metadata), validation, requeue, done |
| runlayer | `src/coordinator/project-coordinator.service.ts` | Add step logs: cycle start, AI call start/end (full prompt), task created |
| runlayer | `src/dashboard/dashboard.controller.ts` | Add 3 endpoints: task logs proxy, agent-health, enable-workers |
| runlayer | `src/agents/agents.service.ts` | Add `countByTypeAndStatus()` and `enableAllWorkers()` methods |
| runlayer | `public/app.js` | Agent health banner + step logs panel + blocked_reason inline |

---

## Task 1: Fix logging-microservice DTO to accept orchestrator fields

**The orchestrator sends these root fields the DTO currently rejects:**
`msg` (instead of `message`), `task_id`, `project_id`, `correlation_id`, `agent_id`, `business_id`, `duration_ms`

With `forbidNonWhitelisted: true`, the entire POST is rejected and logs are lost silently.

**Files:**
- Modify: `logging-microservice/src/logs/dto/log-entry.dto.ts`

- [ ] **Step 1: Update the DTO to accept all orchestrator fields**

Replace the entire file content:

```typescript
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export class LogEntryDto {
  @IsEnum(LogLevel)
  level: LogLevel;

  // Accept both 'message' (standard) and 'msg' (orchestrator convention)
  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  msg?: string;

  @IsString()
  @IsNotEmpty()
  service: string;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  task_id?: string;

  @IsString()
  @IsOptional()
  project_id?: string;

  @IsString()
  @IsOptional()
  business_id?: string;

  @IsString()
  @IsOptional()
  agent_id?: string;

  @IsString()
  @IsOptional()
  correlation_id?: string;

  @IsNumber()
  @IsOptional()
  duration_ms?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
```

- [ ] **Step 2: Update LogsService.ingest() to handle `msg` alias**

In `logging-microservice/src/logs/logs.service.ts`, find the `ingest` method. Change the line that builds `logData` to resolve `msg` → `message`:

```typescript
async ingest(logEntry: LogEntryDto): Promise<void> {
  try {
    const resolvedMessage = logEntry.message || logEntry.msg || '(no message)';
    const logData = {
      level: logEntry.level,
      message: resolvedMessage,
      service: logEntry.service,
      timestamp: logEntry.timestamp || new Date().toISOString(),
      task_id: logEntry.task_id,
      project_id: logEntry.project_id,
      business_id: logEntry.business_id,
      agent_id: logEntry.agent_id,
      correlation_id: logEntry.correlation_id,
      duration_ms: logEntry.duration_ms,
      metadata: logEntry.metadata || {},
    };

    this.logger.log(logEntry.level, resolvedMessage, {
      service: logEntry.service,
      task_id: logEntry.task_id,
      project_id: logEntry.project_id,
      ...logEntry.metadata,
    });

    const serviceLogPath = path.join(
      this.logStoragePath,
      `${logEntry.service}.log`,
    );
    fs.appendFileSync(
      serviceLogPath,
      JSON.stringify(logData) + '\n',
      'utf8',
    );

    const serviceHumanLogPath = path.join(
      this.logStoragePath,
      `${logEntry.service}.human.log`,
    );
    const humanReadable = this.formatHumanReadable(logData);
    fs.appendFileSync(
      serviceHumanLogPath,
      humanReadable + '\n',
      'utf8',
    );
  } catch (error) {
    console.error('Error ingesting log:', error);
    this.logger.error('Error ingesting log', { error: error instanceof Error ? error.message : String(error) });
  }
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd /home/ssf/Documents/Github/logging-microservice && npm run build 2>&1 | tail -20
```

Expected: no errors, `dist/` produced.

- [ ] **Step 4: Commit**

```bash
cd /home/ssf/Documents/Github/logging-microservice
git add src/logs/dto/log-entry.dto.ts src/logs/logs.service.ts
git commit -m "fix: accept orchestrator log fields (msg alias, task_id, project_id)"
```

---

## Task 2: Add task_id and project_id query filters to logging-microservice

**Files:**
- Modify: `logging-microservice/src/logs/logs.controller.ts`
- Modify: `logging-microservice/src/logs/logs.service.ts`

- [ ] **Step 1: Add query params to controller**

In `logging-microservice/src/logs/logs.controller.ts`, replace the `queryLogs` method:

```typescript
@Get('query')
async queryLogs(
  @Query('service') service?: string,
  @Query('level') level?: string,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
  @Query('limit') limit?: number,
  @Query('task_id') taskId?: string,
  @Query('project_id') projectId?: string,
) {
  try {
    const logs = await this.logsService.query({
      service,
      level,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 100,
      taskId,
      projectId,
    });
    return {
      success: true,
      data: logs,
      count: logs.length,
    };
  } catch (error) {
    throw new HttpException(
      {
        success: false,
        message: 'Failed to query logs',
        error: error instanceof Error ? error.message : String(error),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
```

- [ ] **Step 2: Add filter logic to LogsService.query()**

In `logging-microservice/src/logs/logs.service.ts`, update the `query` method signature and add filtering. Find the `query(filters: {...})` method and replace it in full:

```typescript
async query(filters: {
  service?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  taskId?: string;
  projectId?: string;
}): Promise<any[]> {
  const logs: any[] = [];

  try {
    const logFiles = fs.readdirSync(this.logStoragePath).filter(
      (file) => file.endsWith('.log') && !file.includes('error') && !file.includes('.human.log'),
    );

    for (const file of logFiles) {
      if (filters.service && !file.includes(filters.service)) {
        continue;
      }

      const filePath = path.join(this.logStoragePath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);

          if (filters.level && logEntry.level !== filters.level) continue;
          if (filters.startDate && logEntry.timestamp < filters.startDate) continue;
          if (filters.endDate && logEntry.timestamp > filters.endDate) continue;
          if (filters.taskId && logEntry.task_id !== filters.taskId) continue;
          if (filters.projectId && logEntry.project_id !== filters.projectId) continue;

          logs.push(logEntry);

          if (logs.length >= (filters.limit || 100)) break;
        } catch {
          continue;
        }
      }

      if (logs.length >= (filters.limit || 100)) break;
    }
  } catch (error) {
    console.error('Error querying logs:', error);
    this.logger.error('Error querying logs', { error: error instanceof Error ? error.message : String(error) });
  }

  return logs
    .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    .slice(0, filters.limit || 100);
}
```

Note: sort is now **ascending** (oldest first) so timeline renders top-to-bottom chronologically.

- [ ] **Step 3: Build to verify**

```bash
cd /home/ssf/Documents/Github/logging-microservice && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Deploy logging-microservice**

```bash
cd /home/ssf/Documents/Github/logging-microservice && ./scripts/deploy.sh 2>&1 | tail -30
```

Expected: pod restarts, `kubectl get pods -n statex-apps | grep logging` shows `Running`.

- [ ] **Step 5: Smoke-test new filter**

```bash
curl -s "http://localhost:3367/api/logs/query?task_id=test-task-123&limit=5" | python3 -m json.tool
```

Expected: `{"success":true,"data":[],"count":0}` — no error, filter accepted.

- [ ] **Step 6: Commit**

```bash
cd /home/ssf/Documents/Github/logging-microservice
git add src/logs/logs.controller.ts src/logs/logs.service.ts
git commit -m "feat: add task_id and project_id filters to log query endpoint"
```

---

## Task 3: Add countByTypeAndStatus() and enableAllWorkers() to AgentsService

**Files:**
- Modify: `runlayer/src/agents/agents.service.ts`

- [ ] **Step 1: Add the two new methods**

At the bottom of the `AgentsService` class (before the closing `}`), add:

```typescript
async countByTypeAndStatus(): Promise<{ workers: { idle: number; busy: number; disabled: number; total: number }; validators: { idle: number; busy: number; disabled: number; total: number } }> {
  const all = await this.repo.find();
  const workers = all.filter((a) => a.type === 'worker');
  const validators = all.filter((a) => a.type === 'validator');
  const count = (agents: typeof all, status: string) => agents.filter((a) => a.status === status).length;
  return {
    workers: {
      idle: count(workers, 'idle'),
      busy: count(workers, 'busy'),
      disabled: count(workers, 'disabled'),
      total: workers.length,
    },
    validators: {
      idle: count(validators, 'idle'),
      busy: count(validators, 'busy'),
      disabled: count(validators, 'disabled'),
      total: validators.length,
    },
  };
}

async enableAllWorkers(): Promise<number> {
  const disabled = await this.repo.find({ where: { type: 'worker', status: 'disabled' } });
  for (const agent of disabled) {
    agent.status = 'idle';
    agent.failureCount = 0;
  }
  await this.repo.save(disabled);
  return disabled.length;
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add src/agents/agents.service.ts
git commit -m "feat: add countByTypeAndStatus and enableAllWorkers to AgentsService"
```

---

## Task 4: Add 3 new endpoints to DashboardController

**Files:**
- Modify: `runlayer/src/dashboard/dashboard.controller.ts`

The three endpoints:
1. `GET /api/dashboard/tasks/:taskId/logs` — proxy to logging-microservice filtered by task_id
2. `GET /api/dashboard/agent-health` — returns agent counts by type/status
3. `POST /api/admin/agents/enable-workers` — re-enables all disabled workers

- [ ] **Step 1: Update imports and constructor in DashboardController**

Open `src/dashboard/dashboard.controller.ts`. Replace the imports and class header:

```typescript
import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BusinessesService } from '../businesses/businesses.service';
import { ProjectsService } from '../projects/projects.service';
import { AgentsService } from '../agents/agents.service';
import { GoalsService } from '../goals/goals.service';
import { TasksService } from '../tasks/tasks.service';
import { JwtGuard } from '../common/auth/jwt.guard';
import { AdminGuard } from '../common/auth/admin.guard';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly projectsService: ProjectsService,
    private readonly agentsService: AgentsService,
    private readonly goalsService: GoalsService,
    private readonly tasksService: TasksService,
    private readonly configService: ConfigService,
  ) {}
```

Note: the controller base path changes from `dashboard` to `api/dashboard` — verify existing routes still work (they will, since `@Get()`, `@Get('goals')`, `@Get('tasks')` are relative).

- [ ] **Step 2: Add the three new methods at the bottom of the class**

After the existing `allTasks()` method, add:

```typescript
@Get('tasks/:taskId/logs')
@UseGuards(JwtGuard)
async taskLogs(
  @Param('taskId') taskId: string,
  @Query('limit') limit?: string,
) {
  const loggingUrl = this.configService.get<string>('loggingService.url') ?? 'http://logging-microservice:3367';
  const lim = Math.min(Number(limit ?? '200'), 500);
  try {
    const resp = await axios.get(
      `${loggingUrl}/api/logs/query?task_id=${encodeURIComponent(taskId)}&service=runlayer&limit=${lim}`,
      { timeout: 5000 },
    );
    return { logs: resp.data?.data ?? [] };
  } catch {
    return { logs: [], error: 'logging service unavailable' };
  }
}

@Get('agent-health')
@UseGuards(JwtGuard)
async agentHealth() {
  const counts = await this.agentsService.countByTypeAndStatus();
  return {
    ...counts,
    allWorkersDisabled: counts.workers.total > 0 && counts.workers.disabled === counts.workers.total,
    noIdleWorkers: counts.workers.idle === 0,
  };
}

@Post('/admin/agents/enable-workers')
@UseGuards(JwtGuard, AdminGuard)
async enableWorkers() {
  const count = await this.agentsService.enableAllWorkers();
  return { enabled: count, message: `${count} worker(s) set to idle` };
}
```

- [ ] **Step 3: Add ConfigService to DashboardModule imports**

Open `src/dashboard/dashboard.module.ts`. Add `ConfigModule` import:

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DashboardController } from './dashboard.controller';
import { DashboardGateway } from './dashboard.gateway';
import { BusinessesModule } from '../businesses/businesses.module';
import { ProjectsModule } from '../projects/projects.module';
import { AgentsModule } from '../agents/agents.module';
import { GoalsModule } from '../goals/goals.module';
import { TasksModule } from '../tasks/tasks.module';
import { JwtGuard } from '../common/auth/jwt.guard';
import { AdminGuard } from '../common/auth/admin.guard';

@Global()
@Module({
  imports: [ConfigModule, BusinessesModule, ProjectsModule, AgentsModule, GoalsModule, TasksModule],
  controllers: [DashboardController],
  providers: [JwtGuard, AdminGuard, DashboardGateway],
  exports: [DashboardGateway, AdminGuard],
})
export class DashboardModule {}
```

- [ ] **Step 4: Update DashboardController spec to cover new endpoints**

Open `src/dashboard/dashboard.controller.spec.ts`. Replace the full file:

```typescript
import { Test } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { BusinessesService } from '../businesses/businesses.service';
import { ProjectsService } from '../projects/projects.service';
import { AgentsService } from '../agents/agents.service';
import { GoalsService } from '../goals/goals.service';
import { TasksService } from '../tasks/tasks.service';
import { ConfigService } from '@nestjs/config';
import { JwtGuard } from '../common/auth/jwt.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockAgentsService: any;

  beforeEach(async () => {
    mockAgentsService = {
      list: jest.fn().mockResolvedValue([]),
      countByTypeAndStatus: jest.fn().mockResolvedValue({
        workers: { idle: 0, busy: 0, disabled: 5, total: 5 },
        validators: { idle: 2, busy: 0, disabled: 0, total: 2 },
      }),
      enableAllWorkers: jest.fn().mockResolvedValue(5),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: BusinessesService, useValue: { findAll: jest.fn().mockResolvedValue([{ id: 'b1', slug: 'flipflop', status: 'active' }]) } },
        { provide: ProjectsService, useValue: { findByBusiness: jest.fn().mockResolvedValue([{ id: 'p1', slug: 'flipflop', stateSnapshot: { health: 'ok', tasks_active: 2 } }]) } },
        { provide: AgentsService, useValue: mockAgentsService },
        { provide: GoalsService, useValue: { findActiveGoal: jest.fn().mockResolvedValue(null) } },
        { provide: TasksService, useValue: { findByProject: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://logging-microservice:3367') } },
      ],
    })
      .overrideGuard(JwtGuard).useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AdminGuard).useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(DashboardController);
  });

  it('GET /dashboard returns businesses', async () => {
    const result = await controller.overview();
    expect(result.businesses).toHaveLength(1);
  });

  it('GET /dashboard/agent-health returns worker counts with allWorkersDisabled flag', async () => {
    const result = await controller.agentHealth();
    expect(result.workers.disabled).toBe(5);
    expect(result.workers.total).toBe(5);
    expect(result.allWorkersDisabled).toBe(true);
    expect(result.noIdleWorkers).toBe(true);
  });

  it('GET /dashboard/agent-health sets allWorkersDisabled false when some workers are idle', async () => {
    mockAgentsService.countByTypeAndStatus.mockResolvedValue({
      workers: { idle: 1, busy: 0, disabled: 2, total: 3 },
      validators: { idle: 1, busy: 0, disabled: 0, total: 1 },
    });
    const result = await controller.agentHealth();
    expect(result.allWorkersDisabled).toBe(false);
    expect(result.noIdleWorkers).toBe(false);
  });

  it('POST /admin/agents/enable-workers returns enabled count', async () => {
    const result = await controller.enableWorkers();
    expect(result.enabled).toBe(5);
    expect(mockAgentsService.enableAllWorkers).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest src/dashboard/dashboard.controller.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (PASS).

- [ ] **Step 6: Build**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add src/dashboard/dashboard.controller.ts src/dashboard/dashboard.module.ts src/dashboard/dashboard.controller.spec.ts
git commit -m "feat: add agent-health, task logs proxy, and enable-workers endpoints to dashboard"
```

---

## Task 5: Add structured step logging to WorkerPoolService

**Files:**
- Modify: `runlayer/src/worker/worker-pool.service.ts`
- Modify: `runlayer/src/worker/worker-pool.service.spec.ts`

- [ ] **Step 1: Replace console.log and add per-tick agent count logging**

Replace the full `dispatch()` method body in `src/worker/worker-pool.service.ts`:

```typescript
@Cron('*/10 * * * * *')
async dispatch(): Promise<{ dispatched: number }> {
  if (process.env.WORKER_POOL_ENABLED === 'false') return { dispatched: 0 };

  const acquired = await this.redis.acquireLease(POOL_LEASE_KEY, this.replicaId, POOL_LEASE_TTL_MS);
  if (!acquired) return { dispatched: 0 };

  const start = Date.now();
  try {
    const allWorkers = await this.agents.findAllWorkers();
    const idleWorkers = allWorkers.filter((a) => a.status === 'idle');
    const disabledWorkers = allWorkers.filter((a) => a.status === 'disabled');
    const busyWorkers = allWorkers.filter((a) => a.status === 'busy');

    if (idleWorkers.length === 0) {
      await this.logger.log({
        level: disabledWorkers.length > 0 ? 'warn' : 'info',
        msg: 'worker_pool_tick',
        durationMs: Date.now() - start,
        metadata: {
          idle_workers: 0,
          disabled_workers: disabledWorkers.length,
          busy_workers: busyWorkers.length,
          total_workers: allWorkers.length,
          skip_reason: 'no_idle_workers',
        },
      });
      return { dispatched: 0 };
    }

    const pendingTasks = await this.tasks.findPending(idleWorkers.length);
    if (pendingTasks.length === 0) {
      await this.logger.log({
        level: 'info',
        msg: 'worker_pool_tick',
        durationMs: Date.now() - start,
        metadata: {
          idle_workers: idleWorkers.length,
          disabled_workers: disabledWorkers.length,
          busy_workers: busyWorkers.length,
          total_workers: allWorkers.length,
          skip_reason: 'no_pending_tasks',
        },
      });
      return { dispatched: 0 };
    }

    const pairs = pendingTasks.map((task, i) => ({ task, agent: idleWorkers[i] }));

    await Promise.allSettled(
      pairs.map(async ({ task, agent }) => {
        try {
          await this.tasks.assign(task.id, agent.id);
          if (task.type === 'coding') {
            await this.codingWorkerAgent.execute(task.id, agent.id);
          } else {
            await this.workerAgent.execute(task.id, agent.id);
          }
        } catch (err) {
          await this.logger.log({
            level: 'error',
            msg: 'worker_dispatch_error',
            taskId: task.id,
            projectId: task.projectId,
            durationMs: Date.now() - start,
            metadata: { agent_id: agent.id, error: String(err) },
          });
        }
      }),
    );

    await this.logger.log({
      level: 'info',
      msg: 'worker_pool_dispatch',
      durationMs: Date.now() - start,
      metadata: {
        dispatched: pairs.length,
        idle_workers: idleWorkers.length,
        disabled_workers: disabledWorkers.length,
        busy_workers: busyWorkers.length,
        total_workers: allWorkers.length,
        task_ids: pairs.map((p) => p.task.id),
        skip_reason: null,
      },
    });

    return { dispatched: pairs.length };
  } finally {
    await this.redis.releaseLease(POOL_LEASE_KEY);
  }
}
```

- [ ] **Step 2: Add findAllWorkers() to AgentsService**

Open `src/agents/agents.service.ts`. Add after `findIdleValidators`:

```typescript
async findAllWorkers(): Promise<Agent[]> {
  return this.repo.find({ where: { type: 'worker' } });
}
```

- [ ] **Step 3: Update WorkerPoolService constructor to use findAllWorkers**

The `dispatch()` method above calls `this.agents.findAllWorkers()`. The `agents` property is the injected `AgentsService` — no constructor change needed since `AgentsService` is already injected.

- [ ] **Step 4: Update worker-pool spec to test no_idle_workers logging**

Open `src/worker/worker-pool.service.spec.ts`. Add `findAllWorkers` to `mockAgents` and add test:

In `beforeEach`, update `mockAgents`:
```typescript
mockAgents = {
  findIdleWorkers: jest.fn(),
  findAllWorkers: jest.fn(),
};
```

Update the existing `'skips dispatch when no idle workers are available'` test:
```typescript
it('logs warn with skip_reason=no_idle_workers when all workers disabled', async () => {
  mockAgents.findAllWorkers.mockResolvedValue([
    { id: 'w1', status: 'disabled', type: 'worker' },
    { id: 'w2', status: 'disabled', type: 'worker' },
  ]);

  const result = await service.dispatch();

  expect(result).toEqual({ dispatched: 0 });
  expect(mockLogger.log).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'warn',
      msg: 'worker_pool_tick',
      metadata: expect.objectContaining({
        skip_reason: 'no_idle_workers',
        disabled_workers: 2,
        idle_workers: 0,
      }),
    }),
  );
});
```

Also update all existing tests that call `mockAgents.findIdleWorkers` — replace with `mockAgents.findAllWorkers` returning appropriate statuses:

```typescript
// "skips when no idle workers" becomes:
mockAgents.findAllWorkers.mockResolvedValue([]);

// "assigns and executes" becomes:
mockAgents.findAllWorkers.mockResolvedValue([{ id: 'agent-1', status: 'idle', type: 'worker' }]);

// "does not dispatch when pending queue is empty":
mockAgents.findAllWorkers.mockResolvedValue([{ id: 'agent-1', status: 'idle', type: 'worker' }]);

// "routes coding tasks":
mockAgents.findAllWorkers.mockResolvedValue([{ id: 'agent-1', status: 'idle', type: 'worker' }]);

// "logs dispatch errors":
mockAgents.findAllWorkers.mockResolvedValue([{ id: 'agent-1', status: 'idle', type: 'worker' }]);
```

- [ ] **Step 5: Run tests**

```bash
cd /home/ssf/Documents/Github/runlayer && npx jest src/worker/worker-pool.service.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Build**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add src/worker/worker-pool.service.ts src/worker/worker-pool.service.spec.ts src/agents/agents.service.ts
git commit -m "feat: structured pool tick logging with agent counts and skip_reason"
```

---

## Task 6: Add step logging to WorkerAgentService

**Files:**
- Modify: `runlayer/src/worker/worker-agent.service.ts`

Full AI prompt and full AI response go into `metadata` (written to log file). TypeScript only references `model_used`, `tokens`, `outcome` after the log call.

- [ ] **Step 1: Add step log calls throughout execute()**

Open `src/worker/worker-agent.service.ts`. Find the `execute(taskId, agentId)` method.

**After `const budgetStatus = await this.budget.checkLlmBudget(...)` and before the `if (!budgetStatus.allowed)` block**, add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'worker_budget_check',
  taskId,
  projectId: task.projectId,
  durationMs: 0,
  metadata: { allowed: budgetStatus.allowed, used: budgetStatus.used, quota: budgetStatus.quota },
});
```

**Before the AI call** (`await this.aiHttp.call({...})`), add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'worker_ai_call_start',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: {
    model_tier: modelTier,
    attempt: task.attempt,
    task_type: task.type,
    prompt: userPrompt,
  },
});
```

**After the AI call succeeds** (after the `try/catch` block for `aiHttp.call`, when `aiResponse` is populated and no error), add before the schema-check `if`:

```typescript
if (!aiResponse?.error_code) {
  await this.logger.log({
    level: 'info',
    msg: 'worker_ai_call_success',
    taskId,
    projectId: project.id,
    durationMs: Date.now() - aiCallStart,
    metadata: {
      model_used: aiResponse?.model_used ?? modelTier,
      tokens: aiResponse?.token_usage_estimate ?? 0,
      output_ref: aiResponse?.output_ref,
      full_response: aiResponse,
    },
  });
}
```

**Before validation** (`await this.validatorAgent.validate(...)`), add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'worker_validation_start',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: {
    acceptance_criteria: task.acceptanceCriteria,
    output_ref: outputRef,
  },
});
```

**After validation completes** (after the `try/catch` for `validatorAgent.validate`), add:

```typescript
await this.logger.log({
  level: validationOutcome.validation_passed ? 'info' : 'warn',
  msg: 'worker_validation_end',
  taskId,
  projectId: project.id,
  durationMs: 0,
  metadata: {
    passed: validationOutcome.validation_passed,
    reason: validationOutcome.reason,
    verdict: validationOutcome.verdict,
    findings: validationOutcome.findings,
  },
});
```

**Before `return done`** (task completed successfully), add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'worker_task_done',
  taskId,
  projectId: task.projectId,
  durationMs: 0,
  metadata: { output_ref: donePayload },
});
```

- [ ] **Step 2: Update existing error logs to include full prompt**

Find the existing `worker_ai_timeout` log call. Add `prompt_full: userPrompt` to its metadata:

```typescript
metadata: {
  task_type: task.type,
  attempt: task.attempt,
  model_tier: modelTier,
  error: String(err).slice(0, 300),
  prompt_full: userPrompt,
},
```

Find the existing `worker_wrong_schema` log call. Add `prompt_full: userPrompt` and `response_full: aiResponse` to its metadata:

```typescript
metadata: {
  task_type: task.type,
  attempt: task.attempt,
  model_tier: modelTier,
  response_keys: Object.keys(aiResponse).slice(0, 10),
  response_preview: JSON.stringify(aiResponse).slice(0, 500),
  prompt_full: userPrompt,
  response_full: aiResponse,
},
```

- [ ] **Step 3: Build**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add src/worker/worker-agent.service.ts
git commit -m "feat: add step logs to WorkerAgentService (budget, AI call, validation, done)"
```

---

## Task 7: Add step logging to ProjectCoordinatorService

**Files:**
- Modify: `runlayer/src/coordinator/project-coordinator.service.ts`

- [ ] **Step 1: Add cycle_start log**

In `runCycle()`, after `const cycleStart = Date.now();` and after the project/business are loaded, find the `await this.events.publish('cycle.started', ...)` call. Immediately after it, add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'coordinator_cycle_start',
  projectId,
  durationMs: 0,
  metadata: {
    goal_id: activeGoal.id,
    goal_title: activeGoal.title,
    available_workers: idleWorkers.length,
    open_tasks: openTasks.length,
    failed_last_cycle: failedLastCycle.length,
  },
});
```

- [ ] **Step 2: Add coordinator_ai_call_start log**

Find the `response = await this.http.post('/ai/complete', {` call. Just before `response = await this.http.post(...)`, add:

```typescript
const coordPrompt = `${COORD_SYSTEM}\n\n${JSON.stringify(coordinatorInput)}`;
await this.logger.log({
  level: 'info',
  msg: 'coordinator_ai_call_start',
  projectId,
  durationMs: 0,
  metadata: {
    model_tier: 'free',
    prompt: coordPrompt,
  },
});
```

Then change the actual call to use the variable:
```typescript
response = await this.http.post('/ai/complete', {
  model_tier: 'free',
  user_prompt: coordPrompt,   // <-- use variable instead of template literal
  ...
```

- [ ] **Step 3: Add coordinator_ai_call_success log after successful response**

Find the block that processes the response (after the try/catch, where `projectsToRun` and `decisions` are set for the LLM case). After `decisions = (response.data.decisions ?? []) as string[];`, add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'coordinator_ai_call_success',
  projectId,
  durationMs: Date.now() - cycleStart,
  metadata: {
    tasks_proposed: (response.data.new_tasks ?? []).map((t: any) => t.type),
    decisions: response.data.decisions ?? [],
    full_response: response.data,
  },
});
```

- [ ] **Step 4: Add coordinator_task_created log**

Find the loop that creates tasks (where `await this.tasksService.create(...)` is called). After each successful `create`, add:

```typescript
await this.logger.log({
  level: 'info',
  msg: 'coordinator_task_created',
  projectId,
  durationMs: 0,
  metadata: {
    task_id: createdTask.id,
    type: createdTask.type,
    priority: createdTask.priority,
  },
});
```

Where `createdTask` is the return value of `this.tasksService.create(...)` — assign it if not already: `const createdTask = await this.tasksService.create(...)`.

- [ ] **Step 5: Build**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add src/coordinator/project-coordinator.service.ts
git commit -m "feat: add step logs to ProjectCoordinatorService (cycle start, AI call, task created)"
```

---

## Task 8: Deploy runlayer

- [ ] **Step 1: Run full test suite**

```bash
cd /home/ssf/Documents/Github/runlayer && npm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 2: Deploy**

```bash
cd /home/ssf/Documents/Github/runlayer && ./scripts/deploy.sh 2>&1 | tail -30
```

Expected: pod restarts, shows `Running`.

- [ ] **Step 3: Verify pod is healthy**

```bash
kubectl get pods -n statex-apps | grep runlayer
curl -s http://localhost:3390/health
```

Expected: `Running`, health returns OK.

- [ ] **Step 4: Immediately re-enable workers via the new endpoint**

Get a JWT token from the dashboard (or use existing session token):

```bash
TOKEN=$(kubectl exec -n statex-apps deployment/runlayer -c app -- node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || '';
console.log(jwt.sign({ sub: 'admin', role: 'admin' }, secret, { expiresIn: '1h' }));
" 2>/dev/null)
curl -s -X POST http://localhost:3390/api/dashboard/admin/agents/enable-workers \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `{"enabled": 5, "message": "5 worker(s) set to idle"}`

- [ ] **Step 5: Verify workers are now idle**

```bash
kubectl exec -n statex-apps deployment/runlayer -c app -- node -e "
const { Client } = require('pg');
const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
c.connect().then(() => c.query('SELECT type, status, count(*) FROM runlayer.agents GROUP BY type, status ORDER BY type, status')).then(r => { console.log(JSON.stringify(r.rows,null,2)); c.end(); }).catch(e => { console.error(e.message); c.end(); });
" 2>&1
```

Expected: workers show `idle`, not `disabled`.

- [ ] **Step 6: Watch for first task dispatch**

```bash
kubectl logs -n statex-apps deployment/runlayer -c app -f 2>&1 | grep "worker_pool_dispatch\|worker_ai_call_start\|dispatched" | head -5
```

Expected: within 10-20 seconds, see `worker_pool_dispatch` with `dispatched > 0` and then `worker_ai_call_start` entries appearing in the logging service.

---

## Task 9: Add agent health banner and step logs panel to dashboard

**Files:**
- Modify: `runlayer/public/app.js`
- Modify: `runlayer/public/index.html`

- [ ] **Step 1: Add CSS for agent health banner to index.html**

Open `public/index.html`. Find the `<style>` block. Add before the closing `</style>`:

```css
.agent-health-banner { display:none; padding:10px 16px; border-radius:6px; margin-bottom:16px; font-size:0.875rem; font-weight:500; }
.agent-health-banner.warn { background:#fef3c7; border:1px solid #f59e0b; color:#92400e; }
.agent-health-banner.error { background:#fee2e2; border:1px solid #ef4444; color:#991b1b; }
.agent-health-banner button { margin-left:12px; padding:3px 10px; font-size:0.8rem; border:1px solid currentColor; border-radius:4px; background:transparent; cursor:pointer; }
.step-logs-section { margin-top:20px; }
.step-logs-section h4 { font-size:0.9rem; color:#475569; margin-bottom:8px; }
.step-log-entry { padding:8px 10px; border-left:3px solid #e2e8f0; margin-bottom:6px; font-size:0.8rem; background:#f8fafc; border-radius:0 4px 4px 0; }
.step-log-entry.warn { border-left-color:#f59e0b; background:#fffbeb; }
.step-log-entry.error { border-left-color:#ef4444; background:#fef2f2; }
.step-log-entry .log-time { color:#94a3b8; font-size:0.72rem; }
.step-log-entry .log-msg { font-weight:500; color:#334155; }
.step-log-entry .log-meta { margin-top:4px; color:#64748b; font-family:ui-monospace,monospace; font-size:0.72rem; white-space:pre-wrap; word-break:break-word; max-height:200px; overflow-y:auto; display:none; }
.step-log-entry.expanded .log-meta { display:block; }
.step-log-entry .log-expand { font-size:0.7rem; color:#94a3b8; cursor:pointer; margin-left:6px; }
```

- [ ] **Step 2: Add banner container to index.html**

In `public/index.html`, find the `<div id="portfolio-view"` element. Add the banner div immediately before it:

```html
<div id="agent-health-banner" class="agent-health-banner"></div>
```

- [ ] **Step 3: Add loadAgentHealth() function to app.js**

At the top of `public/app.js`, after the `portfolioState` declaration, add:

```javascript
async function loadAgentHealth() {
  const token = getToken();
  if (!token) return;
  const banner = document.getElementById('agent-health-banner');
  if (!banner) return;
  try {
    const resp = await fetch('/api/dashboard/agent-health', { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.allWorkersDisabled) {
      banner.className = 'agent-health-banner error';
      banner.style.display = 'block';
      banner.innerHTML = `⚠ All ${data.workers.total} worker agents are disabled — tasks will not start.
        <button onclick="enableWorkers()">Enable workers</button>`;
    } else if (data.noIdleWorkers && data.workers.total > 0) {
      banner.className = 'agent-health-banner warn';
      banner.style.display = 'block';
      banner.innerHTML = `⚠ No idle workers (${data.workers.busy} busy, ${data.workers.disabled} disabled) — tasks are queued.`;
    } else {
      banner.style.display = 'none';
    }
  } catch { /* banner stays hidden */ }
}

async function enableWorkers() {
  const token = getToken();
  if (!token) { alert('Not authenticated'); return; }
  try {
    const resp = await fetch('/api/dashboard/admin/agents/enable-workers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    alert(data.message || 'Done');
    loadAgentHealth();
  } catch (e) { alert('Failed: ' + e.message); }
}
```

- [ ] **Step 4: Call loadAgentHealth on dashboard load**

In `app.js`, find the `loadPortfolio()` function (or wherever the dashboard first loads). Add `loadAgentHealth()` call at the start of that function. Also add a periodic refresh: find where the portfolio polling or refresh timer is set, add `setInterval(loadAgentHealth, 30000)` alongside it.

If there's no central load function, find the `DOMContentLoaded` or `init()` call and add `loadAgentHealth()` there.

- [ ] **Step 5: Add renderStepLogs() function to app.js**

Add this function after `goBackToGoal()`:

```javascript
async function loadStepLogs(taskId) {
  const token = getToken();
  const container = document.getElementById('step-logs-container');
  if (!container) return;
  container.innerHTML = '<p style="color:#94a3b8;font-size:0.8rem;">Loading step logs…</p>';
  try {
    const resp = await fetch(`/api/dashboard/tasks/${taskId}/logs?limit=200`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = resp.ok ? await resp.json() : { logs: [] };
    const logs = data.logs || [];
    if (!logs.length) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:0.8rem;font-style:italic;">No step logs yet — task has not been picked up by a worker.</p>';
      return;
    }
    const firstError = logs.findIndex((l) => l.level === 'error' || l.level === 'warn');
    container.innerHTML = logs.map((entry, i) => {
      const level = entry.level || 'info';
      const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--';
      const msg = entry.message || entry.msg || '(no message)';
      const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;
      return `<div class="step-log-entry ${level === 'error' ? 'error' : level === 'warn' ? 'warn' : ''}" id="step-log-${i}">
        <span class="log-time">${ts}</span>
        <span class="log-msg" style="margin-left:6px;">${escapeHtml(msg)}</span>
        ${hasMetadata ? `<span class="log-expand" onclick="toggleLogMeta('step-log-${i}')">▶ details</span>` : ''}
        ${hasMetadata ? `<div class="log-meta">${escapeHtml(JSON.stringify(entry.metadata, null, 2))}</div>` : ''}
      </div>`;
    }).join('');
    if (firstError >= 0) {
      const el = document.getElementById(`step-log-${firstError}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (e) {
    container.innerHTML = `<p style="color:#ef4444;font-size:0.8rem;">Failed to load logs: ${escapeHtml(e.message)}</p>`;
  }
}

function toggleLogMeta(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}
```

- [ ] **Step 6: Add step logs section to openExecutionLog()**

Find the `openExecutionLog(taskId, type)` function in `app.js`. After the line that sets `executionLogContainer.innerHTML = ...` (the initial loading template), extend it to include the step logs section:

Replace the `executionLogContainer.innerHTML = ` assignment with:

```javascript
executionLogContainer.innerHTML = `
  <button onclick="goBackToGoal()" style="margin-bottom:12px;padding:6px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;"><- Back to Tasks</button>
  <h3 style="margin-bottom:12px;font-size:1rem;color:#475569;">${type || 'Execution history'}</h3>
  <div id="exec-log-rows">Loading...</div>
  <div class="step-logs-section">
    <h4>Step Logs</h4>
    <div id="step-logs-container"></div>
  </div>
`;
```

Then after the existing code that populates `exec-log-rows`, add:

```javascript
loadStepLogs(taskId);
```

- [ ] **Step 7: Add blocked_reason to task rows in openGoalDetail()**

Find `openGoalDetail()` in `app.js`. Find the `rows` mapping where each `<tr>` is built. Replace the first `<td>` (type column) with:

```javascript
`<td>
  ${t.type || '--'}
  ${(t.status === 'created' && t.attempt > 0 && t.blockedReason) ? `<br><small style="color:#94a3b8;font-size:0.72rem;">${escapeHtml(t.blockedReason)}</small>` : ''}
  ${(t.status === 'failed' && t.blockedReason) ? `<br><small style="color:#ef4444;font-size:0.72rem;">${escapeHtml(t.blockedReason)}</small>` : ''}
</td>`
```

Note: the task API response uses `blockedReason` (camelCase) from the entity. Verify by checking `tasks.controller.ts` findAll response — it spreads the entity directly with `{ ...t, goal_id: t.goalId }`, so `t.blockedReason` is available.

- [ ] **Step 8: Verify in browser**

Start a local port-forward and open the dashboard:

```bash
kubectl port-forward -n statex-apps svc/runlayer 3390:3390 &
```

Open `https://runlayer.alfares.cz/` (or `http://localhost:3390`):
1. Red/yellow banner appears if workers are disabled — ✓
2. "Enable workers" button works and banner disappears — ✓
3. Click a project → task list shows `blockedReason` under stuck tasks — ✓
4. Click a task row → execution log opens → "Step Logs" section shows entries — ✓
5. Click "▶ details" on an AI call entry → full prompt visible — ✓

- [ ] **Step 9: Commit**

```bash
cd /home/ssf/Documents/Github/runlayer
git add public/app.js public/index.html
git commit -m "feat: agent health banner, step logs timeline, blocked_reason inline in dashboard"
```

---

## Task 10: Final deploy and validation

- [ ] **Step 1: Deploy runlayer with frontend changes**

```bash
cd /home/ssf/Documents/Github/runlayer && ./scripts/deploy.sh 2>&1 | tail -20
```

- [ ] **Step 2: Verify agent health endpoint**

```bash
curl -s http://localhost:3390/api/dashboard/agent-health -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `workers.disabled` count, `allWorkersDisabled` flag.

- [ ] **Step 3: Wait for a task to be processed and verify step logs appear**

```bash
# Get a recent task ID
kubectl exec -n statex-apps deployment/runlayer -c app -- node -e "
const { Client } = require('pg');
const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
c.connect().then(() => c.query('SELECT id FROM runlayer.tasks WHERE status IN (\\'in_progress\\', \\'done\\') ORDER BY created_at DESC LIMIT 1')).then(r => { console.log(r.rows[0]?.id); c.end(); }).catch(e => { console.error(e.message); c.end(); });
" 2>&1
```

Then query step logs for that task:

```bash
TASK_ID=<paste-id-here>
curl -s "http://localhost:3367/api/logs/query?task_id=${TASK_ID}&service=runlayer&limit=20" | python3 -m json.tool | grep '"message"\|"level"\|"timestamp"' | head -30
```

Expected: entries with `worker_ai_call_start`, `worker_ai_call_success`, `worker_validation_start`, `worker_task_done` (or error variants).

- [ ] **Step 4: Verify full prompt is stored**

```bash
curl -s "http://localhost:3367/api/logs/query?task_id=${TASK_ID}&service=runlayer&limit=20" | python3 -m json.tool | grep -A2 "worker_ai_call_start"
```

Expected: metadata contains `prompt` field with full prompt text.
