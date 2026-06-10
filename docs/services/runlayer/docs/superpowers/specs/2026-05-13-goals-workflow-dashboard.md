# Goals Workflow & Dashboard Spec

**Date:** 2026-05-13  
**Status:** Approved for implementation

---

## Problem

1. The goal lifecycle skips human review — once a goal is activated the coordinator immediately decomposes it into tasks with no discussion or approval step.
2. The dashboard #goals, #tasks, and #agents nav links show empty screens.
3. The Business Portfolio has no way to create or manage goals from the UI.

---

## Goal Lifecycle — New States

Current: `queued → active → completed / cancelled`

New:
```
queued → planning → approved → active → completed / cancelled
```

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `queued` | Created, awaiting planning | Human (on create) |
| `planning` | Coordinator ran once, proposed task plan stored | System (on "Start Planning") |
| `approved` | Human reviewed and approved the plan | Human (on "Approve Plan") |
| `active` | Tasks created, coordinator running normally | System (on approve) |
| `completed` | All tasks done | System (auto-advance) |
| `cancelled` | Abandoned | Human |

**Invariants:**
- Max 1 goal per project in `planning`, `approved`, or `active` state combined.
- Coordinator `runCycle()` only processes goals with status `active`.
- Coordinator `runPlanningCycle()` processes goals with status `planning`, runs once, stores `proposedPlan`, does NOT create tasks.
- `approve` endpoint creates tasks from `proposedPlan` and transitions goal to `active`.

---

## Backend Changes

### DB Migration: `007_goal_planning_stage.sql`

```sql
ALTER TABLE runlayer.goals
  DROP CONSTRAINT IF EXISTS goals_status_check;

ALTER TABLE runlayer.goals
  ADD CONSTRAINT goals_status_check
  CHECK (status IN ('queued','planning','approved','active','completed','cancelled'));

ALTER TABLE runlayer.goals
  ADD COLUMN IF NOT EXISTS proposed_plan JSONB;

-- Update unique index to cover all "in-flight" statuses
DROP INDEX IF EXISTS runlayer.uq_goals_active_per_project;
CREATE UNIQUE INDEX uq_goals_one_inflight_per_project
  ON runlayer.goals (project_id)
  WHERE status IN ('planning','approved','active');
```

### `Goal` entity — new fields

- `status`: extend type union to include `'planning' | 'approved'`
- `proposedPlan`: `jsonb` nullable — stores the coordinator's proposed task list

### `GoalsService` — new methods

- `startPlanning(goalId)`: queued → planning, triggers coordinator planning cycle
- `storePlan(goalId, plan)`: stores proposed_plan JSON on the goal
- `approve(goalId)`: planning → active, creates tasks from proposed_plan
- `update(goalId, dto)`: patch title/description/constraints/priority (queued only)
- `delete(goalId)`: cancel a queued goal (hard delete allowed for queued; cancel for others)

### `GoalsController` — new endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/projects/:id/goals/:goalId/start-planning` | queued → planning |
| `PATCH` | `/projects/:id/goals/:goalId/approve` | planning → active, creates tasks |
| `PATCH` | `/projects/:id/goals/:goalId` | update title/description (queued only) |
| `DELETE` | `/projects/:id/goals/:goalId` | cancel/delete queued goal |

### `ProjectCoordinatorService` — new method

`runPlanningCycle(goalId, projectId)`: called by `startPlanning`. Sends coordinator prompt asking for a proposed task plan only (no task creation). Returns `ProposedTask[]`. Stores result via `goalsService.storePlan()`. Moves goal to `planning` complete.

Proposed task shape (stored in `proposed_plan`):
```json
[
  {
    "type": "coding",
    "description": "string",
    "acceptance_criteria": ["string"],
    "priority": 1,
    "payload_ref": {},
    "target_service": "optional-string",
    "smoke_test_urls": []
  }
]
```

### `DashboardController` — new endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard/goals` | All goals across all projects, with project slug |
| `GET` | `/dashboard/tasks` | All tasks across all projects, with project slug + goal title |
| `GET` | `/dashboard/agents` | Already exists via `/agents` — no change needed |

---

## Frontend Changes

### `index.html`

- Add `<section id="goals-view">` — flat table: Project, Goal Title, Status, Progress, Created
- Add `<section id="tasks-view">` — flat table: Project, Goal, Type, Status, Priority, Created
- Add `<section id="agents-view">` — flat table: Agent ID, Status, Last Heartbeat
- In each project card: add a Goals sub-section with goal list + "Add Goal" button + per-goal action buttons
- Add "Add Goal" modal (title, description, priority, constraints)
- Add "Plan Review" modal — shows `proposed_plan` as a readable task list, with "Approve" and "Cancel" buttons

### `app.js`

- Wire `sectionMap`: `goals → 'goals-view'`, `tasks → 'tasks-view'`, `agents → 'agents-view'`
- Add `loadGoalsSection()` — fetches `/dashboard/goals`, renders table
- Add `loadTasksSection()` — fetches `/dashboard/tasks`, renders table
- Add `loadAgentsSection()` — fetches `/agents`, renders table
- Hook nav clicks to call the appropriate load function
- Add goal CRUD in portfolio cards:
  - `createGoal(projectId)` — POST to `/projects/:id/goals`
  - `startGoalPlanning(goalId, projectId)` — PATCH `.../start-planning`, then poll for planning result
  - `showPlanReview(goal)` — renders proposed_plan, Approve/Cancel buttons
  - `approveGoalPlan(goalId, projectId)` — PATCH `.../approve`
  - `deleteGoal(goalId, projectId)` — DELETE endpoint

---

## Documentation Updates

- `SPEC.md`: update pipeline to `HUMAN → GOAL → PLANNING → HUMAN APPROVAL → TASK TREE → AGENTS → VALIDATION → DONE`
- `GOALS.md`: document new statuses
- `CLAUDE.md` (this repo): update goal lifecycle table

---

## Out of Scope

- Real-time chat/conversation on goals
- AI-generated goal suggestions
- Editing goals in non-queued states
- Bulk goal operations
