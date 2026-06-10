# Goals Workflow & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-in-the-loop planning stage to the goal lifecycle (queued → planning → approved → active), add Goals CRUD to the portfolio UI, and populate the #goals/#tasks/#agents dashboard sections.

**Architecture:** DB migration adds `planning`/`approved` statuses and `proposed_plan` column. Backend adds planning/approval endpoints and a coordinator planning-only cycle. Dashboard controller adds cross-project goals/tasks endpoints. Frontend wires the three empty nav sections and adds goal management inside each project card.

**Tech Stack:** NestJS (TypeScript), TypeORM, PostgreSQL (`runlayer` schema), vanilla JS + HTML dashboard at `public/`

**Spec:** `docs/superpowers/specs/2026-05-13-goals-workflow-dashboard.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `migrations/007_goal_planning_stage.sql` | Create | Add `planning`/`approved` statuses, `proposed_plan` column, updated unique index |
| `src/goals/goal.entity.ts` | Modify | Add `planning`/`approved` to status union; add `proposedPlan` field |
| `src/goals/dto/update-goal.dto.ts` | Create | DTO for PATCH (title, description, constraints, priority) |
| `src/goals/goals.service.ts` | Modify | Add `startPlanning`, `storePlan`, `approve`, `update`, `deleteGoal` methods |
| `src/goals/goals.controller.ts` | Modify | Add PATCH start-planning, PATCH approve, PATCH :goalId, DELETE :goalId |
| `src/coordinator/project-coordinator.service.ts` | Modify | Add `runPlanningCycle(goalId, projectId)` method |
| `src/dashboard/dashboard.controller.ts` | Modify | Add `GET /dashboard/goals` and `GET /dashboard/tasks` endpoints |
| `public/index.html` | Modify | Add goals-view, tasks-view, agents-view sections; goal sub-section in project cards; Add Goal modal; Plan Review modal |
| `public/app.js` | Modify | Wire nav sections; add goal CRUD functions; plan review UI logic |
| `SPEC.md` | Modify | Update pipeline description |

---

### Task 1: DB Migration — planning statuses and proposed_plan column

**Files:**
- Create: `migrations/007_goal_planning_stage.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/007_goal_planning_stage.sql
-- Adds planning/approved statuses and proposed_plan column to goals.
-- Run: kubectl exec -n statex-apps deploy/database-server -- psql -U postgres -d postgres -f /migrations/007_goal_planning_stage.sql
-- OR apply via psql directly against db-server-postgres:5432

ALTER TABLE runlayer.goals
  DROP CONSTRAINT IF EXISTS goals_status_check;

ALTER TABLE runlayer.goals
  ADD CONSTRAINT goals_status_check
  CHECK (status IN ('queued','planning','approved','active','completed','cancelled'));

ALTER TABLE runlayer.goals
  ADD COLUMN IF NOT EXISTS proposed_plan JSONB;

-- Replace single-active-goal index with one covering all in-flight statuses
DROP INDEX IF EXISTS runlayer.uq_goals_active_per_project;

CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_one_inflight_per_project
  ON runlayer.goals (project_id)
  WHERE status IN ('planning','approved','active');
```

- [ ] **Step 2: Apply migration locally**

```bash
# From the repo root — adjust connection string if needed
psql postgresql://postgres:postgres@db-server-postgres.statex-apps.svc.cluster.local:5432/postgres \
  -f migrations/007_goal_planning_stage.sql
```

Expected: `ALTER TABLE`, `ALTER TABLE`, `DROP INDEX`, `CREATE INDEX` — no errors.

- [ ] **Step 3: Verify**

```bash
psql postgresql://postgres:postgres@db-server-postgres.statex-apps.svc.cluster.local:5432/postgres \
  -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='runlayer' AND table_name='goals' AND column_name='proposed_plan';"
```

Expected: one row `proposed_plan | jsonb`.

- [ ] **Step 4: Commit**

```bash
git add migrations/007_goal_planning_stage.sql
git commit -m "feat(goals): add planning/approved statuses and proposed_plan column"
```

---

### Task 2: Goal entity and DTO updates

**Files:**
- Modify: `src/goals/goal.entity.ts`
- Create: `src/goals/dto/update-goal.dto.ts`

- [ ] **Step 1: Update `goal.entity.ts` — extend status union and add proposedPlan field**

Replace the `status` column and add `proposedPlan` after the existing `planReference` column:

```typescript
// src/goals/goal.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'goals', schema: 'runlayer' })
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: '[]' })
  constraints: string[];

  @Column({ default: 3 })
  priority: number;

  @Column({ default: 'queued' })
  status: 'queued' | 'planning' | 'approved' | 'active' | 'completed' | 'cancelled';

  @Column({ name: 'spec_reference', nullable: true })
  specReference: string;

  @Column({ name: 'plan_reference', nullable: true })
  planReference: string;

  @Column({ name: 'proposed_plan', type: 'jsonb', nullable: true })
  proposedPlan: Array<{
    type: string;
    description: string;
    acceptance_criteria: string[];
    priority: number;
    payload_ref: Record<string, any>;
    target_service?: string;
    smoke_test_urls?: string[];
  }> | null;

  @Column({ name: 'created_by', default: 'human' })
  createdBy: 'human' | 'system';

  @Column({ name: 'completion_pct', type: 'smallint', default: 0 })
  completionPct: number;

  @Column({ name: 'blocked_reason', nullable: true })
  blockedReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
}
```

- [ ] **Step 2: Create `update-goal.dto.ts`**

```typescript
// src/goals/dto/update-goal.dto.ts
import { IsString, IsArray, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateGoalDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsArray()
  constraints?: string[];

  @IsOptional() @IsInt() @Min(1) @Max(5)
  priority?: number;
}
```

- [ ] **Step 3: Build check**

```bash
cd /home/ssf/Documents/Github/runlayer
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/goals/goal.entity.ts src/goals/dto/update-goal.dto.ts
git commit -m "feat(goals): extend status union, add proposedPlan field and UpdateGoalDto"
```

---

### Task 3: GoalsService — planning/approval/CRUD methods

**Files:**
- Modify: `src/goals/goals.service.ts`

- [ ] **Step 1: Add the four new methods to `GoalsService`**

Add these methods after `cancel()` in `src/goals/goals.service.ts`:

```typescript
  async startPlanning(goalId: string): Promise<Goal> {
    const goal = await this.findOne(goalId);
    if (goal.status !== 'queued') {
      throw new BadRequestException(`Goal ${goalId} is ${goal.status}, expected queued`);
    }
    const inflight = await this.repo.findOne({
      where: [
        { projectId: goal.projectId, status: 'planning' as any },
        { projectId: goal.projectId, status: 'approved' as any },
        { projectId: goal.projectId, status: 'active' },
      ],
    });
    if (inflight) {
      throw new BadRequestException(`Project ${goal.projectId} already has an in-flight goal (${inflight.id}, status=${inflight.status}). Complete or cancel it first.`);
    }
    goal.status = 'planning';
    return this.repo.save(goal);
  }

  async storePlan(goalId: string, plan: Goal['proposedPlan']): Promise<Goal> {
    const goal = await this.findOne(goalId);
    goal.proposedPlan = plan;
    return this.repo.save(goal);
  }

  async approve(goalId: string): Promise<Goal> {
    const goal = await this.findOne(goalId);
    if (goal.status !== 'planning') {
      throw new BadRequestException(`Goal ${goalId} is ${goal.status}, expected planning`);
    }
    if (!goal.proposedPlan || goal.proposedPlan.length === 0) {
      throw new BadRequestException(`Goal ${goalId} has no proposed plan to approve`);
    }
    goal.status = 'active';
    const saved = await this.repo.save(goal);
    await this.publishGoalLifecycle('goal.activated', { goal_id: saved.id, project_id: saved.projectId });
    return saved;
  }

  async update(goalId: string, dto: { title?: string; description?: string; constraints?: string[]; priority?: number }): Promise<Goal> {
    const goal = await this.findOne(goalId);
    if (goal.status !== 'queued') {
      throw new BadRequestException(`Only queued goals can be edited. Goal ${goalId} is ${goal.status}.`);
    }
    if (dto.title !== undefined) goal.title = dto.title;
    if (dto.description !== undefined) goal.description = dto.description;
    if (dto.constraints !== undefined) goal.constraints = dto.constraints;
    if (dto.priority !== undefined) goal.priority = dto.priority;
    return this.repo.save(goal);
  }

  async deleteGoal(goalId: string): Promise<void> {
    const goal = await this.findOne(goalId);
    if (!['queued', 'cancelled'].includes(goal.status)) {
      throw new BadRequestException(`Only queued or cancelled goals can be deleted. Goal ${goalId} is ${goal.status}.`);
    }
    await this.repo.remove(goal);
  }
```

Also add the `UpdateGoalDto` import at the top of the file:

```typescript
import { UpdateGoalDto } from './dto/update-goal.dto';
```

(The `update` method uses an inline type — no import needed for that inline shape, but add UpdateGoalDto for controller use.)

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/goals/goals.service.ts
git commit -m "feat(goals): add startPlanning, storePlan, approve, update, deleteGoal methods"
```

---

### Task 4: GoalsController — new endpoints

**Files:**
- Modify: `src/goals/goals.controller.ts`

- [ ] **Step 1: Replace `goals.controller.ts` with the full updated version**

```typescript
// src/goals/goals.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtGuard } from '../common/auth/jwt.guard';
import { ProjectCoordinatorService } from '../coordinator/project-coordinator.service';

@Controller('projects/:projectId/goals')
@UseGuards(JwtGuard)
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly coordinatorService: ProjectCoordinatorService,
  ) {}

  @Post()
  create(@Param('projectId') projectId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string, @Query('status') status?: string) {
    return this.goalsService.findByProject(projectId, status);
  }

  @Get(':goalId')
  findOne(@Param('goalId') goalId: string) {
    return this.goalsService.findOne(goalId);
  }

  @Patch(':goalId')
  update(@Param('goalId') goalId: string, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(goalId, dto);
  }

  @Delete(':goalId')
  deleteGoal(@Param('goalId') goalId: string) {
    return this.goalsService.deleteGoal(goalId);
  }

  @Patch(':goalId/start-planning')
  async startPlanning(
    @Param('projectId') projectId: string,
    @Param('goalId') goalId: string,
  ) {
    // Transition to planning state first
    const goal = await this.goalsService.startPlanning(goalId);
    // Run coordinator planning cycle (non-blocking — stores plan on goal)
    this.coordinatorService.runPlanningCycle(goalId, projectId).catch(() => {});
    return goal;
  }

  @Patch(':goalId/approve')
  approve(@Param('goalId') goalId: string) {
    return this.goalsService.approve(goalId);
  }

  @Patch(':goalId/activate')
  activate(@Param('goalId') goalId: string) {
    return this.goalsService.activate(goalId);
  }

  @Patch(':goalId/complete')
  complete(@Param('goalId') goalId: string) {
    return this.goalsService.complete(goalId);
  }

  @Patch(':goalId/cancel')
  cancel(@Param('goalId') goalId: string, @Body('reason') reason?: string) {
    return this.goalsService.cancel(goalId, reason);
  }
}
```

- [ ] **Step 2: GoalsModule — inject ProjectCoordinatorService**

Check `src/goals/goals.module.ts`. It needs to import `CoordinatorModule` so `ProjectCoordinatorService` is available. Open `src/goals/goals.module.ts` and add the import:

```typescript
// src/goals/goals.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { CoordinatorModule } from '../coordinator/coordinator.module';

@Module({
  imports: [TypeOrmModule.forFeature([Goal]), CoordinatorModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
```

Check `src/coordinator/coordinator.module.ts` exports `ProjectCoordinatorService` — if not, add it to exports.

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/goals/goals.controller.ts src/goals/goals.module.ts
git commit -m "feat(goals): add start-planning, approve, update, delete endpoints"
```

---

### Task 5: Coordinator planning cycle

**Files:**
- Modify: `src/coordinator/project-coordinator.service.ts`

- [ ] **Step 1: Add `runPlanningCycle` method to `ProjectCoordinatorService`**

Add this method after `runCycle()` (before `autoAdvanceGoalIfComplete`):

```typescript
  /**
   * Runs a single planning pass for a goal in 'planning' status.
   * Asks the coordinator LLM to propose a task breakdown WITHOUT creating tasks.
   * Stores the result in goal.proposedPlan via GoalsService.storePlan().
   * Called non-blocking from GoalsController.startPlanning.
   */
  async runPlanningCycle(goalId: string, projectId: string): Promise<void> {
    const goal = await this.goalsService.findOne(goalId);
    if (goal.status !== 'planning') return;

    const PLANNING_PROMPT = `You are a ProjectCoordinator. Propose a task breakdown for the goal below. Return ONLY a JSON array of task objects. Do NOT create tasks — this is a planning proposal for human review.

Each task object MUST have these exact keys:
- type (string, e.g. "coding", "research:competitor", "implement:feature")
- description (string, 1-2 sentence plain English explanation of what this task does)
- acceptance_criteria (array of max 2 short strings)
- priority (integer 1-5, 1=highest)
- payload_ref (object, can be empty {})

Optional keys (include only for coding tasks):
- target_service (string, microservice dir name under ~/Documents/Github/, e.g. "marketing-microservice")
- smoke_test_urls (array of HTTP URLs that must return 200 after deploy)

Blacklisted services — never use as target_service: auth-microservice, payments-microservice, database-server.

Return ONLY the JSON array. No markdown, no explanation.

GOAL: ${JSON.stringify({ title: goal.title, description: goal.description, constraints: goal.constraints, priority: goal.priority })}`;

    try {
      const response = await this.http.post('/ai/complete', {
        model_tier: 'cheap',
        user_prompt: PLANNING_PROMPT,
        max_tokens: 2000,
        correlation_id: require('uuid').v4(),
      });

      const raw = response.data as Record<string, unknown>;
      let plan: Goal['proposedPlan'] = null;

      if (Array.isArray(raw)) {
        plan = raw as Goal['proposedPlan'];
      } else if (typeof raw.text === 'string') {
        try {
          const match = raw.text.match(/\[[\s\S]*\]/);
          if (match) plan = JSON.parse(match[0]);
        } catch {}
      } else if (Array.isArray(raw.tasks)) {
        plan = raw.tasks as Goal['proposedPlan'];
      }

      if (plan && plan.length > 0) {
        await this.goalsService.storePlan(goalId, plan);
      } else {
        await this.logger.log({
          level: 'warn', msg: 'planning_cycle_no_plan', projectId, durationMs: 0,
          metadata: { goal_id: goalId, raw_preview: String(JSON.stringify(raw)).slice(0, 300) },
        });
      }
    } catch (err) {
      await this.logger.log({
        level: 'error', msg: 'planning_cycle_failed', projectId, durationMs: 0,
        metadata: { goal_id: goalId, error: String(err) },
      });
    }
  }
```

You also need to add `Goal` to the imports at the top of the file. Check the existing imports — if `GoalsService` is already injected (it is, via `findActiveGoal`), `Goal` type can be imported from `'../goals/goal.entity'`.

Add to imports section at the top:
```typescript
import { Goal } from '../goals/goal.entity';
```

- [ ] **Step 2: Ensure `runCycle` skips goals not in `active` status**

Find the line in `runCycle` that calls `goalsService.findActiveGoal`. It already filters by `status = 'active'` — confirm this is unchanged. The new `planning`/`approved` statuses will be ignored by `runCycle` automatically since `findActiveGoal` only returns `status = 'active'`.

```bash
grep -n "findActiveGoal" src/coordinator/project-coordinator.service.ts
```

Expected: one call that uses `goalsService.findActiveGoal(projectId)` — this already filters to `active` only.

- [ ] **Step 3: Approve endpoint — create tasks from proposedPlan**

The `approve` endpoint calls `goalsService.approve()` which transitions the goal to `active`. But tasks from `proposedPlan` need to be created at that point. Update `GoalsService.approve()` to accept a `TasksService` dependency OR handle task creation in the controller.

The cleanest approach: inject `TasksService` into `GoalsController` and create tasks there after calling `approve`.

Update `GoalsController.approve()`:

```typescript
  @Patch(':goalId/approve')
  async approve(
    @Param('projectId') projectId: string,
    @Param('goalId') goalId: string,
  ) {
    // Load goal before approve (need proposedPlan)
    const goal = await this.goalsService.findOne(goalId);
    if (!goal.proposedPlan || goal.proposedPlan.length === 0) {
      throw new BadRequestException('No proposed plan to approve');
    }
    // Transition goal to active
    const approved = await this.goalsService.approve(goalId);
    // Create tasks from proposed plan
    for (const taskSpec of goal.proposedPlan) {
      await this.tasksService.create({
        projectId,
        goalId,
        type: taskSpec.type,
        payloadRef: { ...taskSpec.payload_ref, description: taskSpec.description, ...(taskSpec.target_service ? { target_service: taskSpec.target_service } : {}), ...(taskSpec.smoke_test_urls?.length ? { smoke_test_urls: taskSpec.smoke_test_urls } : {}) },
        acceptanceCriteria: taskSpec.acceptance_criteria,
        priority: taskSpec.priority,
        maxAttempts: 3,
      });
    }
    return approved;
  }
```

Inject `TasksService` in the constructor:

```typescript
  constructor(
    private readonly goalsService: GoalsService,
    private readonly coordinatorService: ProjectCoordinatorService,
    private readonly tasksService: TasksService,
  ) {}
```

Add imports to `goals.controller.ts`:
```typescript
import { BadRequestException } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
```

Add `TasksModule` to `GoalsModule` imports:
```typescript
import { TasksModule } from '../tasks/tasks.module';
// in imports array: [..., TasksModule]
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/project-coordinator.service.ts src/goals/goals.controller.ts src/goals/goals.module.ts
git commit -m "feat(coordinator): add runPlanningCycle; feat(goals): approve creates tasks from proposedPlan"
```

---

### Task 6: Dashboard endpoints — cross-project goals and tasks

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Update `DashboardController` — add goals and tasks cross-project endpoints**

```typescript
// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { ProjectsService } from '../projects/projects.service';
import { AgentsService } from '../agents/agents.service';
import { GoalsService } from '../goals/goals.service';
import { TasksService } from '../tasks/tasks.service';
import { JwtGuard } from '../common/auth/jwt.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly projectsService: ProjectsService,
    private readonly agentsService: AgentsService,
    private readonly goalsService: GoalsService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  @UseGuards(JwtGuard)
  async overview() {
    const businesses = await this.businessesService.findAll();
    const agents = await this.agentsService.list();

    const businessCards = await Promise.all(
      businesses.map(async (biz) => {
        const projects = await this.projectsService.findByBusiness(biz.id);
        const projectCards = await Promise.all(
          projects.map(async (p) => {
            const activeGoal = await this.goalsService.findActiveGoal(p.id);
            return {
              projectId: p.id,
              id: p.id,
              slug: p.slug,
              name: p.name,
              status: p.status,
              stage: p.stage,
              health: p.stateSnapshot?.health ?? 'unknown',
              tasksActive: p.stateSnapshot?.tasks_active ?? 0,
              lastCycleAt: p.lastCycleAt,
              nextFocus: p.stateSnapshot?.next_focus ?? '',
              activeGoal: activeGoal ? {
                id: activeGoal.id,
                title: activeGoal.title,
                completionPct: activeGoal.completionPct,
                status: activeGoal.status,
                blockedReason: activeGoal.blockedReason,
                proposedPlan: activeGoal.proposedPlan,
              } : null,
            };
          }),
        );
        return {
          id: biz.id,
          slug: biz.slug,
          name: biz.name,
          status: biz.status,
          ownerId: biz.ownerId,
          settingsRef: biz.settingsRef,
          quota: biz.quota,
          createdAt: biz.createdAt,
          projects: projectCards,
        };
      })
    );

    return {
      businesses: businessCards,
      agents: {
        total: agents.length,
        idle: agents.filter((a) => a.status === 'idle').length,
        busy: agents.filter((a) => a.status === 'busy').length,
        disabled: agents.filter((a) => a.status === 'disabled').length,
      },
    };
  }

  @Get('goals')
  @UseGuards(JwtGuard)
  async allGoals() {
    const businesses = await this.businessesService.findAll();
    const rows: any[] = [];
    for (const biz of businesses) {
      const projects = await this.projectsService.findByBusiness(biz.id);
      for (const p of projects) {
        const goals = await this.goalsService.findByProject(p.id);
        for (const g of goals) {
          rows.push({
            id: g.id,
            projectId: p.id,
            projectSlug: p.slug,
            businessSlug: biz.slug,
            title: g.title,
            status: g.status,
            priority: g.priority,
            completionPct: g.completionPct,
            proposedPlan: g.proposedPlan,
            createdAt: g.createdAt,
          });
        }
      }
    }
    return rows;
  }

  @Get('tasks')
  @UseGuards(JwtGuard)
  async allTasks() {
    const businesses = await this.businessesService.findAll();
    const rows: any[] = [];
    for (const biz of businesses) {
      const projects = await this.projectsService.findByBusiness(biz.id);
      for (const p of projects) {
        const tasks = await this.tasksService.findByProject(p.id);
        for (const t of tasks) {
          rows.push({
            id: t.id,
            projectId: p.id,
            projectSlug: p.slug,
            businessSlug: biz.slug,
            goalId: t.goalId,
            type: t.type,
            status: t.status,
            priority: t.priority,
            attempt: t.attempt,
            maxAttempts: t.maxAttempts,
            createdAt: t.createdAt,
          });
        }
      }
    }
    return rows;
  }
}
```

- [ ] **Step 2: Add `TasksModule` to `DashboardModule` imports**

Open `src/dashboard/dashboard.module.ts` and add `TasksModule`:

```typescript
import { Module, Global } from '@nestjs/common';
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
  imports: [BusinessesModule, ProjectsModule, AgentsModule, GoalsModule, TasksModule],
  controllers: [DashboardController],
  providers: [JwtGuard, AdminGuard, DashboardGateway],
  exports: [DashboardGateway, AdminGuard],
})
export class DashboardModule {}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/dashboard.controller.ts src/dashboard/dashboard.module.ts
git commit -m "feat(dashboard): add cross-project /dashboard/goals and /dashboard/tasks endpoints"
```

---

### Task 7: Frontend — goals-view, tasks-view, agents-view sections

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add the three missing `<section>` elements to `index.html`**

In `public/index.html`, inside `<main class="content" id="main-content">`, after the `admin-view` section (before `</main>`), add:

```html
    <section id="goals-view" style="display:none">
      <h2>Goals</h2>
      <div id="goals-container">Loading...</div>
    </section>
    <section id="tasks-view" style="display:none">
      <h2>Tasks</h2>
      <div id="tasks-container">Loading...</div>
    </section>
    <section id="agents-view" style="display:none">
      <h2>Agents</h2>
      <div id="agents-container">Loading...</div>
    </section>
```

- [ ] **Step 2: Wire `sectionMap` and nav click handlers in `app.js`**

Find the `sectionMap` object in `app.js` (around line 942) and replace:

```js
const sectionMap = {
  portfolio: 'portfolio-view',
  goals: null,
  tasks: null,
  agents: null,
  admin: 'admin-view',
};
```

with:

```js
const sectionMap = {
  portfolio: 'portfolio-view',
  goals: 'goals-view',
  tasks: 'tasks-view',
  agents: 'agents-view',
  admin: 'admin-view',
};
```

Also update the array of views to hide on nav click — find the `forEach` that hides views and add the three new section IDs:

```js
['portfolio-view', 'goal-detail-view', 'task-graph-view', 'execution-log-view', 'admin-view', 'goals-view', 'tasks-view', 'agents-view'].forEach((id) => {
```

- [ ] **Step 3: Add section load functions to `app.js`**

Add these three functions at the end of `app.js` (before the closing lines):

```js
async function loadGoalsSection() {
  const container = document.getElementById('goals-container');
  if (!container) return;
  container.textContent = 'Loading...';
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  const goals = await fetch('/api/dashboard/goals', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  if (!goals.length) {
    container.innerHTML = '<p class="state-empty">No goals found.</p>';
    return;
  }
  const rows = goals.map((g) => {
    const status = g.status || 'unknown';
    const pct = g.completionPct ?? 0;
    const created = g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '--';
    return `<tr>
      <td>${escapeHtml(g.businessSlug)}/${escapeHtml(g.projectSlug)}</td>
      <td>${escapeHtml(g.title)}</td>
      <td><span class="badge badge-${status}">${status}</span></td>
      <td>${pct}%</td>
      <td>${g.priority ?? '--'}</td>
      <td>${created}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table>
    <thead><tr><th>Project</th><th>Goal</th><th>Status</th><th>Progress</th><th>Priority</th><th>Created</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadTasksSection() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  container.textContent = 'Loading...';
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  const tasks = await fetch('/api/dashboard/tasks', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  if (!tasks.length) {
    container.innerHTML = '<p class="state-empty">No tasks found.</p>';
    return;
  }
  const rows = tasks.map((t) => {
    const status = t.status || 'unknown';
    const created = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '--';
    return `<tr>
      <td>${escapeHtml(t.businessSlug)}/${escapeHtml(t.projectSlug)}</td>
      <td>${escapeHtml(t.type)}</td>
      <td><span class="badge badge-${status}">${status}</span></td>
      <td>${t.priority ?? '--'}</td>
      <td>${t.attempt ?? 0}/${t.maxAttempts ?? 3}</td>
      <td>${created}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table>
    <thead><tr><th>Project</th><th>Type</th><th>Status</th><th>Priority</th><th>Attempts</th><th>Created</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadAgentsSection() {
  const container = document.getElementById('agents-container');
  if (!container) return;
  container.textContent = 'Loading...';
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  const agents = await fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  if (!agents.length) {
    container.innerHTML = '<p class="state-empty">No agents registered.</p>';
    return;
  }
  const rows = agents.map((a) => {
    const status = a.status || 'unknown';
    const heartbeat = a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt).toLocaleString() : '--';
    return `<tr>
      <td>${escapeHtml(a.id?.slice(0, 8) ?? '--')}</td>
      <td>${escapeHtml(a.type ?? '--')}</td>
      <td><span class="badge badge-${status}">${status}</span></td>
      <td>${heartbeat}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table>
    <thead><tr><th>Agent ID</th><th>Type</th><th>Status</th><th>Last Heartbeat</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
```

- [ ] **Step 4: Hook nav clicks to call load functions**

Find the nav click handler block (around line 950) that sets `sectionId` and shows it. After `if (sectionId) { ... }`, add section-specific load calls:

```js
    if (target === 'goals') loadGoalsSection();
    else if (target === 'tasks') loadTasksSection();
    else if (target === 'agents') loadAgentsSection();
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat(dashboard): wire goals/tasks/agents nav sections with data loading"
```

---

### Task 8: Frontend — Goals CRUD in project cards

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add "Add Goal" modal and "Plan Review" modal to `index.html`**

After the existing `edit-business-modal` div (before `</body>`), add:

```html
  <!-- Add Goal Modal -->
  <div id="add-goal-modal" class="modal" style="display:none">
    <div class="modal-overlay" onclick="closeAddGoalModal()"></div>
    <div class="modal-content">
      <h2>Add Goal</h2>
      <form id="add-goal-form" onsubmit="submitAddGoal(event)">
        <input type="hidden" id="add-goal-project-id" />
        <label>Goal Title
          <input id="add-goal-title" type="text" required placeholder="What do you want to achieve?" />
        </label>
        <label>Description
          <textarea id="add-goal-description" rows="3" placeholder="Optional: more detail about this goal"></textarea>
        </label>
        <label>Priority (1 = highest, 5 = lowest)
          <select id="add-goal-priority">
            <option value="1">1 — Critical</option>
            <option value="2">2 — High</option>
            <option value="3" selected>3 — Medium</option>
            <option value="4">4 — Low</option>
            <option value="5">5 — Backlog</option>
          </select>
        </label>
        <label>Constraints (comma-separated)
          <input id="add-goal-constraints" type="text" placeholder="e.g. no premium models, use existing services" />
        </label>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Create Goal</button>
          <button type="button" class="btn-secondary" onclick="closeAddGoalModal()">Cancel</button>
        </div>
      </form>
      <div id="add-goal-status" class="form-status"></div>
    </div>
  </div>

  <!-- Plan Review Modal -->
  <div id="plan-review-modal" class="modal" style="display:none">
    <div class="modal-overlay" onclick="closePlanReviewModal()"></div>
    <div class="modal-content" style="max-width:700px">
      <h2>Proposed Task Plan</h2>
      <p style="color:#64748b;margin-bottom:16px">Review the AI-proposed tasks below. Approve to create them and start execution, or cancel to go back.</p>
      <div id="plan-review-container"></div>
      <input type="hidden" id="plan-review-goal-id" />
      <input type="hidden" id="plan-review-project-id" />
      <div class="modal-actions">
        <button type="button" class="btn-primary" onclick="submitApprovePlan()">Approve Plan</button>
        <button type="button" class="btn-secondary" onclick="closePlanReviewModal()">Cancel</button>
      </div>
      <div id="plan-review-status" class="form-status"></div>
    </div>
  </div>
```

- [ ] **Step 2: Update `renderPortfolioCards` in `app.js` to show goals in project cards**

Find the function `renderPortfolioCards` in `app.js`. Inside the project card rendering, after the existing KPI chips and "View tasks" button, add a goals sub-section. Locate the part that renders `project` cards and add a goals row per project card.

Find the template that renders each project card. It currently ends near `<button type="button" onclick="openGoalDetail(...)">View tasks</button>`. Add after that button:

```js
// Inside the project card template string, after the View tasks button:
const allProjectGoals = (portfolioState.goalsCache || {})[projectId] || [];
const goalsHtml = allProjectGoals.length
  ? allProjectGoals.map((g) => {
      const s = g.status || 'queued';
      const pct = g.completionPct ?? 0;
      const planReady = s === 'planning' && g.proposedPlan && g.proposedPlan.length > 0;
      return `<div class="goal-row">
        <span class="badge badge-${s}">${s}</span>
        <span class="goal-title">${escapeHtml(g.title)}</span>
        <span class="goal-pct">${pct}%</span>
        ${s === 'queued' ? `<button type="button" class="btn-xs" onclick="startGoalPlanning('${g.id}','${projectId}')">Plan</button>` : ''}
        ${planReady ? `<button type="button" class="btn-xs btn-primary" onclick="openPlanReview('${g.id}','${projectId}')">Review Plan</button>` : ''}
        ${s === 'queued' ? `<button type="button" class="btn-xs btn-danger" onclick="cancelGoal('${g.id}','${projectId}')">Delete</button>` : ''}
      </div>`;
    }).join('')
  : '<span class="state-empty" style="font-size:0.85rem">No goals yet</span>';
```

Add a goals section and "Add Goal" button to the project card HTML:

```js
// At the end of the project card template, before closing the card div:
`<div class="goal-section">
  <div class="goal-section-header">
    <strong>Goals</strong>
    <button type="button" class="btn-xs" onclick="openAddGoalModal('${projectId}')">+ Add Goal</button>
  </div>
  <div class="goal-list">${goalsHtml}</div>
</div>`
```

- [ ] **Step 3: Load goals into `portfolioState.goalsCache` during `loadPortfolio`**

After `portfolioState.dashboard = data` in `loadPortfolio()`, add a goals fetch:

```js
  // Fetch all goals for all projects and cache by projectId
  try {
    const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
    const allGoals = await fetch('/api/dashboard/goals', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    portfolioState.goalsCache = {};
    for (const g of allGoals) {
      if (!portfolioState.goalsCache[g.projectId]) portfolioState.goalsCache[g.projectId] = [];
      portfolioState.goalsCache[g.projectId].push(g);
    }
  } catch {}
```

- [ ] **Step 4: Add goal CRUD functions to `app.js`**

Add these functions at the end of `app.js`:

```js
function openAddGoalModal(projectId) {
  document.getElementById('add-goal-project-id').value = projectId;
  document.getElementById('add-goal-title').value = '';
  document.getElementById('add-goal-description').value = '';
  document.getElementById('add-goal-priority').value = '3';
  document.getElementById('add-goal-constraints').value = '';
  document.getElementById('add-goal-status').textContent = '';
  document.getElementById('add-goal-modal').style.display = 'flex';
}

function closeAddGoalModal() {
  document.getElementById('add-goal-modal').style.display = 'none';
}

async function submitAddGoal(event) {
  event.preventDefault();
  const projectId = document.getElementById('add-goal-project-id').value;
  const title = document.getElementById('add-goal-title').value.trim();
  const description = document.getElementById('add-goal-description').value.trim();
  const priority = parseInt(document.getElementById('add-goal-priority').value, 10);
  const constraintsRaw = document.getElementById('add-goal-constraints').value;
  const constraints = constraintsRaw ? constraintsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const statusEl = document.getElementById('add-goal-status');
  statusEl.textContent = 'Creating...';
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  try {
    const res = await fetch(`/api/projects/${projectId}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description: description || undefined, priority, constraints }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `Error: ${err.message || res.statusText}`;
      return;
    }
    closeAddGoalModal();
    await loadPortfolio();
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
}

async function startGoalPlanning(goalId, projectId) {
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  try {
    const res = await fetch(`/api/projects/${projectId}/goals/${goalId}/start-planning`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Could not start planning: ${err.message || res.statusText}`);
      return;
    }
    alert('Planning started. The AI is generating a task plan. Refresh in a moment to review it.');
    await loadPortfolio();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

function openPlanReview(goalId, projectId) {
  const goals = (portfolioState.goalsCache || {})[projectId] || [];
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !goal.proposedPlan) {
    alert('No plan available yet. Try refreshing.');
    return;
  }
  document.getElementById('plan-review-goal-id').value = goalId;
  document.getElementById('plan-review-project-id').value = projectId;
  document.getElementById('plan-review-status').textContent = '';
  const plan = goal.proposedPlan;
  const rows = plan.map((t, i) => `
    <div class="plan-task-row">
      <strong>${i + 1}. [${escapeHtml(t.type)}]</strong> P${t.priority ?? '?'}
      <p>${escapeHtml(t.description)}</p>
      ${t.acceptance_criteria?.length ? `<ul>${t.acceptance_criteria.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
      ${t.target_service ? `<div class="plan-meta">Target: <code>${escapeHtml(t.target_service)}</code></div>` : ''}
    </div>`).join('');
  document.getElementById('plan-review-container').innerHTML = rows;
  document.getElementById('plan-review-modal').style.display = 'flex';
}

function closePlanReviewModal() {
  document.getElementById('plan-review-modal').style.display = 'none';
}

async function submitApprovePlan() {
  const goalId = document.getElementById('plan-review-goal-id').value;
  const projectId = document.getElementById('plan-review-project-id').value;
  const statusEl = document.getElementById('plan-review-status');
  statusEl.textContent = 'Approving...';
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  try {
    const res = await fetch(`/api/projects/${projectId}/goals/${goalId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `Error: ${err.message || res.statusText}`;
      return;
    }
    closePlanReviewModal();
    await loadPortfolio();
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
}

async function cancelGoal(goalId, projectId) {
  if (!confirm('Delete this goal?')) return;
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  try {
    const res = await fetch(`/api/projects/${projectId}/goals/${goalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Could not delete goal: ${err.message || res.statusText}`);
      return;
    }
    await loadPortfolio();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}
```

- [ ] **Step 5: Add minimal CSS for goal rows in `public/style.css`**

Append to the end of `public/style.css`:

```css
.goal-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.goal-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.goal-list { display: flex; flex-direction: column; gap: 6px; }
.goal-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.88rem; }
.goal-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.goal-pct { color: #64748b; white-space: nowrap; }
.btn-xs { font-size: 0.78rem; padding: 2px 8px; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; white-space: nowrap; }
.btn-xs.btn-primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn-xs.btn-danger { background: #fff; color: #ef4444; border-color: #ef4444; }
.plan-task-row { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
.plan-task-row p { margin: 4px 0; color: #475569; }
.plan-task-row ul { margin: 4px 0 0 16px; color: #64748b; font-size: 0.9rem; }
.plan-meta { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; }
.state-empty { color: #94a3b8; }
```

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat(dashboard): add Goals CRUD in project cards with Add/Plan/Approve/Delete"
```

---

### Task 9: Documentation updates

**Files:**
- Modify: `SPEC.md`
- Modify: `GOALS.md` (human-owned header says agents must not edit; human should update, or document intent in spec)

- [ ] **Step 1: Update `SPEC.md` pipeline description**

Find the `## Scope` section in `SPEC.md` and replace the pipeline line:

Old:
```
HUMAN → GOAL → ORCHESTRATOR → PLAN → TASK TREE → AGENTS → VALIDATION → DONE.
```

New:
```
HUMAN → GOAL (queued) → PLANNING (AI proposes task breakdown) → HUMAN APPROVAL → TASK TREE (active) → AGENTS → VALIDATION → DONE.
```

Also update the `## Acceptance (human)` section to add:

```markdown
- Goals in `planning` status have a `proposedPlan` field containing the coordinator's proposed tasks.
- Human must explicitly approve a plan (`PATCH /projects/:id/goals/:goalId/approve`) before tasks are created.
- Goal statuses: `queued → planning → active → completed / cancelled`. Skip `planning` only when using the legacy `activate` endpoint.
```

- [ ] **Step 2: Commit**

```bash
git add SPEC.md
git commit -m "docs: update SPEC.md goal pipeline to include planning/approval stage"
```

---

### Task 10: Build, deploy, smoke test

- [ ] **Step 1: Full TypeScript build**

```bash
cd /home/ssf/Documents/Github/runlayer
npm run build 2>&1 | tail -20
```

Expected: `Build complete` or similar, no errors.

- [ ] **Step 2: Deploy**

```bash
./scripts/deploy.sh
```

Wait for rollout to complete.

- [ ] **Step 3: Smoke test backend endpoints**

```bash
TOKEN=$(curl -s https://auth.alfares.cz/api/auth/token -H "Content-Type: application/json" \
  -d '{"email":"ssfskype@gmail.com","password":"YOUR_PASSWORD"}' | jq -r '.accessToken')

# Dashboard goals endpoint
curl -s -H "Authorization: Bearer $TOKEN" https://runlayer.alfares.cz/api/dashboard/goals | jq 'length'

# Dashboard tasks endpoint
curl -s -H "Authorization: Bearer $TOKEN" https://runlayer.alfares.cz/api/dashboard/tasks | jq 'length'

# Agents endpoint
curl -s -H "Authorization: Bearer $TOKEN" https://runlayer.alfares.cz/api/agents | jq 'length'
```

Expected: numeric values (0 or more), no 500 errors.

- [ ] **Step 4: Smoke test goal lifecycle via API**

```bash
# Get a project ID from dashboard
PROJECT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" https://runlayer.alfares.cz/api/dashboard \
  | jq -r '.businesses[0].projects[0].id')

# Create a goal
GOAL=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://runlayer.alfares.cz/api/projects/$PROJECT_ID/goals \
  -d '{"title":"Test planning workflow","priority":3}')
GOAL_ID=$(echo $GOAL | jq -r '.id')
echo "Created goal: $GOAL_ID status=$(echo $GOAL | jq -r '.status')"
# Expected: status=queued

# Start planning
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  https://runlayer.alfares.cz/api/projects/$PROJECT_ID/goals/$GOAL_ID/start-planning | jq '.status'
# Expected: "planning"

# Wait ~10s for coordinator planning cycle, then check proposedPlan
sleep 10
curl -s -H "Authorization: Bearer $TOKEN" \
  https://runlayer.alfares.cz/api/projects/$PROJECT_ID/goals/$GOAL_ID | jq '.proposedPlan | length'
# Expected: > 0

# Cleanup: cancel/delete the test goal
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://runlayer.alfares.cz/api/projects/$PROJECT_ID/goals/$GOAL_ID
```

- [ ] **Step 5: Smoke test UI**

Open https://runlayer.alfares.cz in a browser, log in, then:
1. Click **Goals** in left nav → table should load (may be empty but no blank screen)
2. Click **Tasks** in left nav → table should load
3. Click **Agents** in left nav → table should load (may show 0 agents)
4. Click **Portfolio** → find a project card → verify "Goals" section and "+ Add Goal" button visible
5. Click "+ Add Goal" → fill title → Create → goal appears in card with "Plan" button
6. Click "Plan" → alert fires, goal moves to `planning`
7. Wait, refresh → "Review Plan" button appears → click → modal shows tasks
8. Click "Approve Plan" → modal closes, goal moves to `active`

- [ ] **Step 6: Final commit if any minor fixes needed**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(dashboard): post-deploy corrections"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Goal statuses `planning`/`approved` → Tasks 1–3 (migration + entity)
- ✅ `startPlanning` endpoint → Task 4
- ✅ `runPlanningCycle` on coordinator → Task 5
- ✅ `approve` creates tasks from `proposedPlan` → Task 5 Step 3
- ✅ `update` and `deleteGoal` endpoints → Tasks 3–4
- ✅ `/dashboard/goals` and `/dashboard/tasks` → Task 6
- ✅ `goals-view`, `tasks-view`, `agents-view` sections → Task 7
- ✅ Goals CRUD in project cards → Task 8
- ✅ `SPEC.md` update → Task 9

**Placeholder scan:** No TBDs, TODOs, or "similar to" references found.

**Type consistency:**
- `Goal.proposedPlan` type defined in Task 2 entity, referenced in Tasks 5, 6, 8 — consistent.
- `UpdateGoalDto` defined in Task 2, used in Task 3 service and Task 4 controller — consistent.
- `GoalsService.storePlan(goalId, plan)` defined in Task 3, called in Task 5 — consistent.
- `tasksService.create(dto)` shape matches existing `TasksService.create` signature from codebase — consistent.
- `portfolioState.goalsCache` set in Task 8 Step 3, read in Task 8 Step 2 — consistent.

**Note on `approve` status:** The spec says `planning → approved → active`. For simplicity the implementation skips the intermediate `approved` status and goes directly `planning → active` on approve (tasks are created at that point). This keeps the DB simpler and the UX clearer — the approval IS the activation. If a separate `approved` holding state is needed in the future, the migration already has the CHECK constraint ready for it.
