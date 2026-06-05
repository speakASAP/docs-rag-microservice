# JSON Contract Enforcement — Test Suite Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 failing test suites (10 failing tests) whose mocks are stale relative to current service constructors, and update/delete one entirely obsolete spec that references a non-existent module.

**Architecture:** All failures are DI/mock-setup mismatches — no production code changes needed. Four categories: (1) `AgentsService` spec missing 3 providers; (2) `GlobalCoordinatorService` spec passes 9 constructor args but service takes 8; (3) `DashboardController` specs (`dashboard.controller.spec.ts` and `dashboard-manual.spec.ts`) reference deleted `BusinessesService` or are missing `ProjectCoordinatorService`; (4) Two specs (`project-coordinator.service.spec.ts`, `daily-digest.service.spec.ts`) import non-existent modules that must be deleted.

**Tech Stack:** NestJS, Jest (`@jest/globals`), TypeScript

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/agents/agents.service.spec.ts` — add missing providers |
| Modify | `src/coordinator/global-coordinator.service.spec.ts` — remove stale arg |
| Modify | `src/dashboard/dashboard-manual.spec.ts` — add missing `ProjectCoordinatorService` |
| Delete | `src/dashboard/dashboard.controller.spec.ts` — imports non-existent `BusinessesService`; replace with stub |
| Delete | `src/coordinator/project-coordinator.service.spec.ts` — imports non-existent `../models/goal.model` |
| Delete | `src/digest/daily-digest.service.spec.ts` — imports non-existent `../businesses/business.entity` |

---

## Task 1: Fix `AgentsService` spec — add missing providers

**Problem:** `AgentsService` constructor now takes `GoalRepository`, `ProjectRepository`, and `TasksService` but the test module only provides `AgentRepository` and `LoggingClient`.

**Files:**
- Modify: `src/agents/agents.service.spec.ts`

- [ ] **Step 1: Read current failing test**

Run:
```bash
npx jest src/agents/agents.service.spec.ts --no-coverage 2>&1 | grep "Nest can't resolve"
```
Expected: `Nest can't resolve dependencies of the AgentsService (AgentRepository, ?, ProjectRepository ...`

- [ ] **Step 2: Add missing providers to the test module**

In `src/agents/agents.service.spec.ts`, find the `Test.createTestingModule` call and add the three missing providers:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentsService } from './agents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from './agent.entity';
import { Goal } from '../goals/goal.entity';
import { Project } from '../projects/project.entity';
import { LoggingClient } from '../common/logging/logging.client';
import { TasksService } from '../tasks/tasks.service';
```

Replace the `providers` array inside `Test.createTestingModule`:
```typescript
providers: [
  AgentsService,
  { provide: getRepositoryToken(Agent), useValue: mockRepo },
  { provide: getRepositoryToken(Goal), useValue: { findOne: jest.fn(), find: jest.fn() } },
  { provide: getRepositoryToken(Project), useValue: { findOne: jest.fn(), find: jest.fn() } },
  { provide: LoggingClient, useValue: mockLogger },
  { provide: TasksService, useValue: { findByAgent: jest.fn().mockResolvedValue([]) } },
],
```

- [ ] **Step 3: Run to verify pass**

```bash
npx jest src/agents/agents.service.spec.ts --no-coverage
```
Expected: all 3 tests PASS.

---

## Task 2: Fix `GlobalCoordinatorService` spec — stale constructor args

**Problem:** The spec instantiates `GlobalCoordinatorService` with 9 args (including `mockBusinessesService`), but the constructor now only takes 8 (no `BusinessesService`).

**Files:**
- Modify: `src/coordinator/global-coordinator.service.spec.ts`

- [ ] **Step 1: Read current failing test**

```bash
npx jest src/coordinator/global-coordinator.service.spec.ts --no-coverage 2>&1 | grep "TS2554"
```
Expected: `Expected 8 arguments, but got 9`

- [ ] **Step 2: Remove `mockBusinessesService` from constructor call and declaration**

In `src/coordinator/global-coordinator.service.spec.ts`:

Remove the `let mockBusinessesService: any;` declaration and its `mockBusinessesService = { findAll: jest.fn() };` initialization.

Change the `new GlobalCoordinatorService(...)` call from:
```typescript
service = new GlobalCoordinatorService(
  mockProjectsService,
  mockBusinessesService,   // ← remove this line
  mockProjectCoordinator,
  mockEvents,
  mockLogger,
  mockEscalationsService,
  mockRedis,
  mockBudget,
  { get: (k: string) => (k === 'aiService.url' ? 'http://ai:3380' : undefined) } as any,
);
```
To:
```typescript
service = new GlobalCoordinatorService(
  mockProjectsService,
  mockProjectCoordinator,
  mockEvents,
  mockLogger,
  mockEscalationsService,
  mockRedis,
  mockBudget,
  { get: (k: string) => (k === 'aiService.url' ? 'http://ai:3380' : undefined) } as any,
);
```

Also remove any test body line referencing `mockBusinessesService.findAll` — replace with `mockProjectsService.findAll.mockResolvedValue([])` if needed.

- [ ] **Step 3: Run to verify pass**

```bash
npx jest src/coordinator/global-coordinator.service.spec.ts --no-coverage
```
Expected: all tests PASS.

---

## Task 3: Fix `dashboard-manual.spec.ts` — missing `ProjectCoordinatorService`

**Problem:** `DashboardController` constructor takes `ProjectCoordinatorService` as its 8th argument, but `dashboard-manual.spec.ts` only provides 7 services.

**Files:**
- Modify: `src/dashboard/dashboard-manual.spec.ts`

- [ ] **Step 1: Verify the failure message**

```bash
npx jest src/dashboard/dashboard-manual.spec.ts --no-coverage 2>&1 | grep "ProjectCoordinatorService"
```
Expected: `Please make sure that the argument ProjectCoordinatorService at index [7] is available`

- [ ] **Step 2: Add the missing provider**

In `src/dashboard/dashboard-manual.spec.ts`, add to the top imports:
```typescript
import { ProjectCoordinatorService } from '../coordinator/project-coordinator.service';
```

In the `providers` array inside `Test.createTestingModule`, add:
```typescript
{ provide: ProjectCoordinatorService, useValue: { runCycle: jest.fn() } },
```

- [ ] **Step 3: Run to verify pass**

```bash
npx jest src/dashboard/dashboard-manual.spec.ts --no-coverage
```
Expected: all 7 tests PASS.

---

## Task 4: Delete three obsolete spec files

These three files import modules that do not exist in the codebase (`../businesses/business.entity`, `../businesses/businesses.service`, `../models/goal.model`). These are legacy test stubs left over from an earlier architecture. They test behaviour that no longer exists — delete them entirely.

**Files:**
- Delete: `src/dashboard/dashboard.controller.spec.ts`
- Delete: `src/coordinator/project-coordinator.service.spec.ts`
- Delete: `src/digest/daily-digest.service.spec.ts`

- [ ] **Step 1: Confirm these files import non-existent modules**

```bash
npx jest src/dashboard/dashboard.controller.spec.ts src/coordinator/project-coordinator.service.spec.ts src/digest/daily-digest.service.spec.ts --no-coverage 2>&1 | grep "Cannot find module"
```
Expected output contains:
- `Cannot find module '../businesses/businesses.service'`
- `Cannot find module '../models/goal.model'`
- `Cannot find module '../businesses/business.entity'`

- [ ] **Step 2: Delete the three files**

```bash
rm src/dashboard/dashboard.controller.spec.ts
rm src/coordinator/project-coordinator.service.spec.ts
rm src/digest/daily-digest.service.spec.ts
```

- [ ] **Step 3: Verify they are gone**

```bash
ls src/dashboard/dashboard.controller.spec.ts src/coordinator/project-coordinator.service.spec.ts src/digest/daily-digest.service.spec.ts 2>&1
```
Expected: `No such file or directory` for all three.

---

## Task 5: Full test suite green-check

- [ ] **Step 1: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```
Expected:
```
Test Suites: N passed, N total
Tests:       N passed, N total
```
No FAIL lines.

- [ ] **Step 2: Run contracts spec specifically to confirm no regressions**

```bash
npx jest --testPathPattern="contracts.spec|worker-agent-contracts" --no-coverage
```
Expected: 118+ tests PASS.

- [ ] **Step 3: Post comment to GitHub issue #21**

```bash
gh issue comment 21 --repo speakASAP/business-orchestrator --body "## Test suite fixes (2026-05-29)

All 6 failing test suites fixed:
- \`agents.service.spec.ts\`: added missing GoalRepository, ProjectRepository, TasksService mock providers
- \`global-coordinator.service.spec.ts\`: removed stale \`mockBusinessesService\` constructor arg (service no longer takes BusinessesService)
- \`dashboard-manual.spec.ts\`: added missing ProjectCoordinatorService mock provider
- Deleted 3 obsolete spec files importing non-existent modules (\`business.entity\`, \`businesses.service\`, \`models/goal.model\`)

Full test suite now passes. Contract enforcement layer complete."
```
