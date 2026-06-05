# Pending Approval Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every task created or re-queued land in `pending_approval` by default so no task ever auto-executes without explicit user approval.

**Architecture:** Flip `Project.executionMode` default from `'auto'` to `'manual'` in the entity, add a SQL migration that updates all existing rows, then delete the now-redundant `interceptPendingForManualMode` sweep from `WorkerPoolService`.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Jest

---

## Files Changed

| Action | File | Why |
|--------|------|-----|
| Modify | `src/projects/project.entity.ts:38` | Change column default to `'manual'` |
| Create | `migrations/010_default_execution_mode_manual.sql` | Flip existing rows + alter column default |
| Modify | `src/worker/worker-pool.service.ts` | Remove `interceptPendingForManualMode` and its call site |
| Modify | `src/worker/worker-pool.service.spec.ts` | Remove tests for deleted method; add guard test |
| Modify | `src/projects/project-mode.spec.ts` | Update default-value assertion |

---

### Task 1: Update project entity default

**Files:**
- Modify: `src/projects/project.entity.ts:38`
- Test: `src/projects/project-mode.spec.ts`

- [ ] **Step 1: Update the failing assertion in the spec file**

Open `src/projects/project-mode.spec.ts`. Find the test that checks the entity default:

```typescript
it('new Project has undefined executionMode before save', () => {
  const p = new Project();
  expect(p.executionMode).toBeUndefined();
});
```

Change it to:

```typescript
it('new Project has undefined executionMode before save', () => {
  const p = new Project();
  // TypeORM applies column defaults at the DB level, not on the JS object,
  // so the in-memory value is still undefined — but the DB default is now 'manual'.
  expect(p.executionMode).toBeUndefined();
});
```

That test doesn't actually break because TypeORM doesn't apply column defaults in JS memory. Add a new test directly below it:

```typescript
it('executionMode column default is manual (verified via entity metadata)', () => {
  const col = getMetadataArgsStorage().columns.find(
    (c) => c.target === Project && c.propertyName === 'executionMode',
  );
  expect((col?.options as any)?.default).toBe('manual');
});
```

Also add the missing import at the top of the file:

```typescript
import { getMetadataArgsStorage } from 'typeorm';
import { Project } from './project.entity';
```

- [ ] **Step 2: Run the new test to confirm it fails**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest src/projects/project-mode.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `expected 'auto' to be 'manual'`

- [ ] **Step 3: Change the column default in the entity**

Edit `src/projects/project.entity.ts` line 38:

```typescript
// Before
@Column({ name: 'execution_mode', default: 'auto' })
executionMode: 'manual' | 'auto';

// After
@Column({ name: 'execution_mode', default: 'manual' })
executionMode: 'manual' | 'auto';
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx jest src/projects/project-mode.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/projects/project.entity.ts src/projects/project-mode.spec.ts
git commit -m "feat(projects): change executionMode default from auto to manual"
```

---

### Task 2: Write SQL migration

**Files:**
- Create: `migrations/010_default_execution_mode_manual.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/010_default_execution_mode_manual.sql
-- Makes manual the default execution mode so all tasks require explicit approval.
-- All additive/data-only changes, safe to run on live prod.

BEGIN;

SET lock_timeout = '3s';

-- Flip all existing projects that are still on auto → manual.
UPDATE business_orchestrator.projects
  SET execution_mode = 'manual'
  WHERE execution_mode = 'auto';

-- Change the column default so new projects created via raw SQL also default to manual.
-- (TypeORM entity default is already updated separately.)
ALTER TABLE business_orchestrator.projects
  ALTER COLUMN execution_mode SET DEFAULT 'manual';

COMMIT;
```

- [ ] **Step 2: Verify the file exists and is readable**

```bash
cat /home/ssf/Documents/Github/business-orchestrator/migrations/010_default_execution_mode_manual.sql
```

Expected: prints the SQL above without errors.

- [ ] **Step 3: Commit**

```bash
git add migrations/010_default_execution_mode_manual.sql
git commit -m "feat(migrations): 010 flip execution_mode default to manual, update all existing projects"
```

---

### Task 3: Remove `interceptPendingForManualMode` from WorkerPoolService

**Files:**
- Modify: `src/worker/worker-pool.service.ts`
- Modify: `src/worker/worker-pool.service.spec.ts`

- [ ] **Step 1: Identify what to delete in the service**

Open `src/worker/worker-pool.service.ts`. The method to delete is lines 31–49:

```typescript
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

Also delete its call site in `dispatch()`:

```typescript
await this.interceptPendingForManualMode().catch((err) => {
  this.logger.log({
    level: 'error',
    msg: 'manual_mode_intercept_error',
    durationMs: Date.now() - start,
    metadata: { error: String(err) },
  }).catch(() => {});
});
```

- [ ] **Step 2: Write a guard test in the spec file before touching the source**

Open `src/worker/worker-pool.service.spec.ts`. Find the describe block for `dispatch()` and add this test:

```typescript
it('dispatch never calls markPendingApproval (intercept sweep removed)', async () => {
  // findPending returns empty so dispatch exits early — markPendingApproval must never be called
  mockTasks.findPending.mockResolvedValue([]);
  mockAgents.findAllWorkers.mockResolvedValue([]);
  await service.dispatch();
  expect(mockTasks.markPendingApproval).not.toHaveBeenCalled();
});
```

Make sure `mockTasks` has a `markPendingApproval` mock. If it doesn't, add:

```typescript
markPendingApproval: jest.fn().mockResolvedValue(undefined),
```

to the `mockTasks` object in `beforeEach`.

- [ ] **Step 3: Run the guard test to confirm it currently FAILS (intercept still present)**

```bash
npx jest src/worker/worker-pool.service.spec.ts --no-coverage -t "dispatch never calls markPendingApproval" 2>&1 | tail -20
```

Expected: FAIL — `markPendingApproval` was called.

- [ ] **Step 4: Delete `interceptPendingForManualMode` and its call site from the service**

After the edit, the `dispatch()` method should open like this (the `interceptPendingForManualMode` call block is gone):

```typescript
@Cron('*/10 * * * * *')
async dispatch(): Promise<{ dispatched: number }> {
  if (process.env.WORKER_POOL_ENABLED === 'false') return { dispatched: 0 };

  const acquired = await this.redis.acquireLease(POOL_LEASE_KEY, this.replicaId, POOL_LEASE_TTL_MS);
  if (!acquired) return { dispatched: 0 };

  const start = Date.now();
  try {
    const allWorkers = await this.agents.findAllWorkers();
    // ... rest unchanged
```

Also remove any imports or constructor injections that were only used by `interceptPendingForManualMode`. Check whether `ProjectsService` is used anywhere else in `worker-pool.service.ts`. If it is only used in `interceptPendingForManualMode`, remove:
- The `private readonly projectsService: ProjectsService` constructor parameter
- The `ProjectsService` import
- The `ProjectsService` entry in the `WorkerModule` providers/imports if it was only there for the pool

Run a quick check:

```bash
grep -n "projectsService\|ProjectsService" /home/ssf/Documents/Github/business-orchestrator/src/worker/worker-pool.service.ts
```

If the grep returns nothing, the import and constructor param can be safely removed.

- [ ] **Step 5: Remove any now-stale tests for `interceptPendingForManualMode` in the spec**

Search the spec file:

```bash
grep -n "interceptPending\|manual_mode_intercept\|markPendingApproval\|findAll\|manualProjects" \
  /home/ssf/Documents/Github/business-orchestrator/src/worker/worker-pool.service.spec.ts
```

Delete any `it(...)` blocks that tested `interceptPendingForManualMode` directly or relied on `projectsService.findAll` being called.

- [ ] **Step 6: Run the full worker-pool spec**

```bash
npx jest src/worker/worker-pool.service.spec.ts --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS including the new guard test.

- [ ] **Step 7: Run the full test suite to catch regressions**

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS (or only pre-existing failures unrelated to this change).

- [ ] **Step 8: Commit**

```bash
git add src/worker/worker-pool.service.ts src/worker/worker-pool.service.spec.ts
git commit -m "refactor(worker): remove interceptPendingForManualMode — all projects now default to manual mode"
```

---

### Task 4: Apply the migration to the database

- [ ] **Step 1: Run the migration**

```bash
kubectl exec -n statex-apps deploy/database-server -- \
  psql -U dbadmin -d business_orchestrator \
  -f /dev/stdin < /home/ssf/Documents/Github/business-orchestrator/migrations/010_default_execution_mode_manual.sql
```

If `kubectl exec` with stdin is unavailable, copy the file first:

```bash
kubectl cp /home/ssf/Documents/Github/business-orchestrator/migrations/010_default_execution_mode_manual.sql \
  statex-apps/$(kubectl get pod -n statex-apps -l app=database-server -o jsonpath='{.items[0].metadata.name}'):/tmp/010.sql

kubectl exec -n statex-apps deploy/database-server -- \
  psql -U dbadmin -d business_orchestrator -f /tmp/010.sql
```

Expected output:
```
BEGIN
UPDATE <N>
ALTER TABLE
COMMIT
```

- [ ] **Step 2: Verify the migration result**

```bash
kubectl exec -n statex-apps deploy/database-server -- \
  psql -U dbadmin -d business_orchestrator -c \
  "SELECT execution_mode, count(*) FROM business_orchestrator.projects GROUP BY execution_mode;"
```

Expected: only `manual` rows, zero `auto` rows.

- [ ] **Step 3: Verify column default**

```bash
kubectl exec -n statex-apps deploy/database-server -- \
  psql -U dbadmin -d business_orchestrator -c \
  "SELECT column_default FROM information_schema.columns
   WHERE table_schema='business_orchestrator' AND table_name='projects' AND column_name='execution_mode';"
```

Expected: `column_default = 'manual'`

---

### Task 5: Deploy and smoke-test

- [ ] **Step 1: Build the service**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npm run build 2>&1 | tail -20
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 2: Deploy**

```bash
./scripts/deploy.sh 2>&1 | tail -30
```

Expected: deploy completes, pod restarts, health endpoint responds.

- [ ] **Step 3: Verify health**

```bash
curl -s https://orchestrator.alfares.cz/health | jq .
```

Expected: `{"status":"ok"}` or similar healthy response.

- [ ] **Step 4: Trigger a coordinator cycle and confirm tasks land in pending_approval**

```bash
./scripts/orch-trigger-cycle.sh <any-active-project-slug>
sleep 5
./scripts/orch-check-tasks.sh <any-active-project-slug>
```

Expected: any newly created tasks show `status: pending_approval`, not `status: created`.

- [ ] **Step 5: Confirm the dashboard shows the Approve/Reject buttons for the new tasks**

Open https://orchestrator.alfares.cz in a browser. Navigate to the project. Verify newly created tasks appear in the "Pending Approval" queue with Approve and Reject buttons visible.
