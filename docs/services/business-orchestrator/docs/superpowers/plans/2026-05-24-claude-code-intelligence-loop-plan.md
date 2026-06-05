# Claude Code Intelligence Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude Code as a planning agent and post-completion review agent inside business-orchestrator, creating a self-improving loop where every completed goal generates a GitHub issue + optional PR with orchestrator improvements.

**Architecture:** Two new NestJS modules (`CcPlannerModule`, `GoalReviewModule`) each containing a single service that shells out to the `claude` CLI subprocess — the same pattern `ShellExecService` already uses for `deploy.sh`. `ProjectCoordinator` gains an optional CC planning branch (guarded by `CC_PLANNING_ENABLED`) and fires a fire-and-forget review after every goal completes. The `gh` CLI creates GitHub issues, PRs, and wiki entries.

**Tech Stack:** NestJS, TypeScript, `child_process.spawn`, `claude` CLI, `gh` CLI, existing `ShellExecService`, `TraceService`, `McpFilesystemClient`, `LoggingClient`.

**Spec:** `docs/superpowers/specs/2026-05-24-claude-code-intelligence-loop-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/cc-planner/cc-planner.service.ts` | Spawn CC subprocess for goal → task decomposition; fallback contract |
| `src/cc-planner/cc-planner.module.ts` | NestJS module wiring for CcPlannerService |
| `src/cc-planner/cc-planner.service.spec.ts` | Unit tests |
| `src/goal-review/goal-review.service.ts` | Fetch trace, spawn CC review, create GH issue/PR, append wiki |
| `src/goal-review/goal-review.module.ts` | NestJS module wiring for GoalReviewService |
| `src/goal-review/goal-review.service.spec.ts` | Unit tests |
| `docs/agents/cc-planner-prompt.md` | Planning prompt template |
| `docs/agents/cc-review-prompt.md` | Review prompt template |

### Modified files

| File | Change |
|---|---|
| `src/config/configuration.ts` | Add `ccAgent` config block |
| `src/coordinator/coordinator.module.ts` | Import `CcPlannerModule`, `GoalReviewModule` |
| `src/coordinator/project-coordinator.service.ts` | Inject both services; CC planning branch; fire review after goal completes |
| `src/app.module.ts` | Import `CcPlannerModule`, `GoalReviewModule` |

---

## Task 1: Config — add `ccAgent` block

**Files:**
- Modify: `src/config/configuration.ts`

- [ ] **Step 1: Add ccAgent block to configuration**

Open `src/config/configuration.ts` and add after the `codingAgent` block (before the closing `})`):

```typescript
  ccAgent: {
    planningEnabled: process.env.CC_PLANNING_ENABLED === 'true',
    reviewEnabled: process.env.CC_REVIEW_ENABLED !== 'false',
    cliPath: process.env.CC_CLI_PATH ?? 'claude',
    timeoutMs: parseInt(process.env.CC_CLI_TIMEOUT_MS ?? '120000', 10),
    githubRepo: process.env.GITHUB_REPO ?? '',
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/configuration.ts
git commit -m "feat(cc-loop): add ccAgent config block"
```

---

## Task 2: Prompt templates

**Files:**
- Create: `docs/agents/cc-planner-prompt.md`
- Create: `docs/agents/cc-review-prompt.md`

- [ ] **Step 1: Create the planning prompt template**

Create `docs/agents/cc-planner-prompt.md`:

````markdown
# CC Planner Prompt

You are acting as the ProjectCoordinator for the "{{PROJECT_SLUG}}" project.
Your job is to decompose the active goal into a DAG of concrete, atomic coding tasks.

## Active Goal

Title: {{GOAL_TITLE}}
Constraints: {{GOAL_CONSTRAINTS}}
Completion so far: {{COMPLETION_PCT}}%

## Current State

```json
{{STATE_JSON}}
```

## Available Workers

{{AVAILABLE_WORKERS}} workers idle right now.

## Tasks already in progress

{{OPEN_TASKS}}

## Tasks that failed last cycle

{{FAILED_TASKS}}

## Project SPEC

```
{{SPEC_CONTENT}}
```

## Project PLAN

```
{{PLAN_CONTENT}}
```

## Instructions

1. Read SPEC and PLAN as the source of truth.
2. Identify the next highest-value increment given current state and open/failed tasks.
3. Create at most {{AVAILABLE_WORKERS}} tasks, preferring fewer broader tasks over many fine-grained ones.
4. Every task must be independently deployable (no implicit ordering unless expressed in `blocks`/`blockedBy`).
5. Return ONLY valid JSON — no markdown fences, no explanation.

## Required output schema

```json
{
  "new_tasks": [
    {
      "type": "coding",
      "idempotency_key": "kebab-case-unique-slug",
      "payload_ref": {
        "description": "Exact file(s) to change and what to change"
      },
      "acceptance_criteria": ["measurable outcome"],
      "priority": 2,
      "max_attempts": 3,
      "target_service": "{{PROJECT_SLUG}}",
      "smoke_test_urls": ["http://{{PROJECT_SLUG}}:3390/health"]
    }
  ],
  "state_patch": {},
  "decisions": ["why these tasks were chosen"]
}
```
````

- [ ] **Step 2: Create the review prompt template**

Create `docs/agents/cc-review-prompt.md`:

````markdown
# CC Review Prompt

You are a senior engineer doing a post-mortem review of a completed goal in the business-orchestrator system.

## Completed Goal

Title: {{GOAL_TITLE}}
Description: {{GOAL_DESCRIPTION}}
Project: {{PROJECT_SLUG}}

## Project SPEC

```
{{SPEC_CONTENT}}
```

## Project PLAN

```
{{PLAN_CONTENT}}
```

## Full Execution Trace

```json
{{TRACE_JSON}}
```

## Instructions

1. Study the trace carefully: tasks created, executions, error logs, model calls, retries.
2. Think about how YOU would have decomposed and executed this goal as a senior engineer.
3. Identify specific inefficiencies, missed steps, poor task decomposition, or prompt weaknesses.
4. Be concrete — cite task IDs, error codes, or log messages as evidence.
5. If the orchestrator did well, say so (`verdict: "ok"`).
6. Proposed changes must be realistic code or prompt edits — no vague suggestions.
7. Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

## Required output schema

```json
{
  "verdict": "ok | needs_improvement",
  "summary": "2-3 sentence summary of what happened",
  "cc_approach": "What you would have done differently (empty string if verdict is ok)",
  "findings": [
    {
      "severity": "high | medium | low",
      "area": "planning | execution | validation | prompts",
      "description": "What went wrong",
      "evidence": "Specific trace reference (task ID, error code, log message)"
    }
  ],
  "proposed_changes": [
    {
      "file": "relative/path/to/file.ts",
      "description": "What to change",
      "diff_hint": "Specific change: replace X with Y because Z"
    }
  ],
  "pr_title": "fix(orchestrator): <concise title if needs_improvement, else empty string>",
  "pr_body": "## Summary\n- bullet points\n\n## Why\n- reasoning\n\n## Files changed\n- list",
  "wiki_entry": "One paragraph markdown describing this review for the CC-Review-Log wiki page"
}
```
````

- [ ] **Step 3: Commit**

```bash
git add docs/agents/cc-planner-prompt.md docs/agents/cc-review-prompt.md
git commit -m "feat(cc-loop): add CC planner and review prompt templates"
```

---

## Task 3: `CcPlannerService` — implementation + tests

**Files:**
- Create: `src/cc-planner/cc-planner.service.spec.ts`
- Create: `src/cc-planner/cc-planner.service.ts`
- Create: `src/cc-planner/cc-planner.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/cc-planner/cc-planner.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CcPlannerService, CcPlannerInput } from './cc-planner.service';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { LoggingClient } from '../common/logging/logging.client';

const mockShell = { run: jest.fn() };
const mockLogger = { log: jest.fn().mockResolvedValue(undefined) };
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'ccAgent.cliPath': 'claude',
      'ccAgent.timeoutMs': 5000,
    };
    return map[key];
  }),
};

const makeInput = (): CcPlannerInput => ({
  projectId: 'proj-1',
  projectSlug: 'my-service',
  goal: { id: 'g-1', title: 'Add health endpoint', constraints: [], specReference: null, planReference: null, completionPct: 0 },
  state: { cycle: 1 },
  availableWorkers: 2,
  openTasks: [],
  failedTasks: [],
  specContent: 'SPEC content',
  planContent: 'PLAN content',
});

describe('CcPlannerService', () => {
  let service: CcPlannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CcPlannerService,
        { provide: ShellExecService, useValue: mockShell },
        { provide: LoggingClient, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(CcPlannerService);
    jest.clearAllMocks();
  });

  it('returns parsed coordinator output on valid CC response', async () => {
    const ccOutput = {
      new_tasks: [{ type: 'coding', idempotency_key: 'add-health', payload_ref: { description: 'edit health.ts' }, acceptance_criteria: ['returns 200'], priority: 2, max_attempts: 3, target_service: 'my-service', smoke_test_urls: [] }],
      state_patch: {},
      decisions: ['first task'],
    };
    mockShell.run.mockResolvedValue({ success: true, exitCode: 0, stdout: JSON.stringify(ccOutput), stderr: '' });

    const result = await service.plan(makeInput());

    expect(result.new_tasks).toHaveLength(1);
    expect(result.new_tasks[0].idempotency_key).toBe('add-health');
    expect(result.decisions).toEqual(['first task']);
  });

  it('throws on non-zero exit code', async () => {
    mockShell.run.mockResolvedValue({ success: false, exitCode: 1, stdout: '', stderr: 'error' });

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_subprocess_failed');
  });

  it('throws on invalid JSON stdout', async () => {
    mockShell.run.mockResolvedValue({ success: true, exitCode: 0, stdout: 'not json', stderr: '' });

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_invalid_json');
  });

  it('throws on missing new_tasks field', async () => {
    mockShell.run.mockResolvedValue({ success: true, exitCode: 0, stdout: JSON.stringify({ state_patch: {}, decisions: [] }), stderr: '' });

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_invalid_json');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest cc-planner.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `CcPlannerService` not found.

- [ ] **Step 3: Implement `CcPlannerService`**

Create `src/cc-planner/cc-planner.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { LoggingClient } from '../common/logging/logging.client';

export interface CcPlannerInput {
  projectId: string;
  projectSlug: string;
  goal: {
    id: string;
    title: string;
    constraints: string[];
    specReference: string | null;
    planReference: string | null;
    completionPct: number;
  };
  state: Record<string, unknown>;
  availableWorkers: number;
  openTasks: string[];
  failedTasks: string[];
  specContent: string;
  planContent: string;
}

export interface CcPlannerOutput {
  new_tasks: Array<{
    type: string;
    idempotency_key: string;
    payload_ref: Record<string, unknown>;
    acceptance_criteria: string[];
    priority: number;
    max_attempts: number;
    target_service: string;
    smoke_test_urls: string[];
  }>;
  state_patch: Record<string, unknown>;
  decisions: string[];
}

@Injectable()
export class CcPlannerService {
  private readonly cliPath: string;
  private readonly timeoutMs: number;
  private readonly promptTemplate: string;

  constructor(
    private readonly shell: ShellExecService,
    private readonly logger: LoggingClient,
    private readonly config: ConfigService,
  ) {
    this.cliPath = this.config.get<string>('ccAgent.cliPath') ?? 'claude';
    this.timeoutMs = this.config.get<number>('ccAgent.timeoutMs') ?? 120_000;
    const tplPath = path.join(process.cwd(), 'docs/agents/cc-planner-prompt.md');
    this.promptTemplate = fs.existsSync(tplPath) ? fs.readFileSync(tplPath, 'utf-8') : '';
  }

  async plan(input: CcPlannerInput): Promise<CcPlannerOutput> {
    const prompt = this.buildPrompt(input);
    const tmpFile = path.join(os.tmpdir(), `cc-plan-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    let result: { success: boolean; exitCode: number; stdout: string; stderr: string };
    try {
      result = await this.shell.run(
        `${this.cliPath} --print < ${tmpFile}`,
        { timeoutMs: this.timeoutMs },
      );
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }

    if (!result.success) {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_subprocess_failed',
        projectId: input.projectId, durationMs: 0,
        metadata: { exitCode: result.exitCode, stderr: result.stderr.slice(0, 500) },
      });
      throw new Error('cc_planner_subprocess_failed');
    }

    let parsed: unknown;
    try {
      const clean = this.extractJson(result.stdout);
      parsed = JSON.parse(clean);
    } catch {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_invalid_json',
        projectId: input.projectId, durationMs: 0,
        metadata: { stdout_preview: result.stdout.slice(0, 300) },
      });
      throw new Error('cc_planner_invalid_json');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).new_tasks)) {
      throw new Error('cc_planner_invalid_json');
    }

    return parsed as CcPlannerOutput;
  }

  private buildPrompt(input: CcPlannerInput): string {
    return (this.promptTemplate || this.defaultTemplate())
      .replace('{{PROJECT_SLUG}}', input.projectSlug)
      .replace('{{GOAL_TITLE}}', input.goal.title)
      .replace('{{GOAL_CONSTRAINTS}}', input.goal.constraints.join(', ') || 'none')
      .replace('{{COMPLETION_PCT}}', String(input.goal.completionPct))
      .replace('{{STATE_JSON}}', JSON.stringify(input.state, null, 2))
      .replace('{{AVAILABLE_WORKERS}}', String(input.availableWorkers))
      .replace('{{OPEN_TASKS}}', input.openTasks.join('\n') || 'none')
      .replace('{{FAILED_TASKS}}', input.failedTasks.join('\n') || 'none')
      .replace('{{SPEC_CONTENT}}', input.specContent.slice(0, 4000))
      .replace('{{PLAN_CONTENT}}', input.planContent.slice(0, 4000));
  }

  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) return trimmed;
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
  }

  private defaultTemplate(): string {
    return `You are a ProjectCoordinator. Decompose the goal for project "{{PROJECT_SLUG}}" into coding tasks.
Goal: {{GOAL_TITLE}}
Constraints: {{GOAL_CONSTRAINTS}}
Completion: {{COMPLETION_PCT}}%
State: {{STATE_JSON}}
Workers: {{AVAILABLE_WORKERS}}
Open tasks: {{OPEN_TASKS}}
Failed tasks: {{FAILED_TASKS}}
SPEC: {{SPEC_CONTENT}}
PLAN: {{PLAN_CONTENT}}
Return JSON: {"new_tasks":[...],"state_patch":{},"decisions":[...]}`;
  }
}
```

- [ ] **Step 4: Create the module**

Create `src/cc-planner/cc-planner.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CcPlannerService } from './cc-planner.service';
import { CodingWorkerModule } from '../coding-worker/coding-worker.module';
import { LoggingClient } from '../common/logging/logging.client';

@Module({
  imports: [CodingWorkerModule],
  providers: [CcPlannerService, LoggingClient],
  exports: [CcPlannerService],
})
export class CcPlannerModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest cc-planner.service.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/cc-planner/
git commit -m "feat(cc-loop): add CcPlannerService with subprocess + fallback contract"
```

---

## Task 4: `GoalReviewService` — implementation + tests

**Files:**
- Create: `src/goal-review/goal-review.service.spec.ts`
- Create: `src/goal-review/goal-review.service.ts`
- Create: `src/goal-review/goal-review.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/goal-review/goal-review.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoalReviewService, GoalReviewInput } from './goal-review.service';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { TraceService } from '../trace/trace.service';
import { McpFilesystemClient } from '../mcp-client/mcp-filesystem.client';
import { LoggingClient } from '../common/logging/logging.client';

const mockShell = { run: jest.fn() };
const mockTrace = { buildGoalTrace: jest.fn() };
const mockMcp = { readFile: jest.fn() };
const mockLogger = { log: jest.fn().mockResolvedValue(undefined) };
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'ccAgent.cliPath': 'claude',
      'ccAgent.timeoutMs': 5000,
      'ccAgent.githubRepo': 'speakASAP/business-orchestrator',
    };
    return map[key];
  }),
};

const makeInput = (): GoalReviewInput => ({
  goalId: 'g-1',
  projectId: 'proj-1',
  projectSlug: 'my-service',
});

const makeTrace = () => ({
  id: 'g-1', projectId: 'proj-1', title: 'Test goal', description: null,
  status: 'completed', completionPct: 100, createdAt: new Date(), completedAt: new Date(),
  batches: [], unbatched: [],
});

const makeOkReview = () => ({
  verdict: 'ok',
  summary: 'Ran well.',
  cc_approach: '',
  findings: [],
  proposed_changes: [],
  pr_title: '',
  pr_body: '',
  wiki_entry: 'Goal completed cleanly.',
});

const makeImprovementReview = () => ({
  verdict: 'needs_improvement',
  summary: 'Too many tasks created.',
  cc_approach: 'Would create 2 tasks instead of 5.',
  findings: [{ severity: 'medium', area: 'planning', description: 'Over-decomposed', evidence: 'task-id-1' }],
  proposed_changes: [{ file: 'src/coordinator/project-coordinator.service.ts', description: 'Fix prompt', diff_hint: 'change X to Y' }],
  pr_title: 'fix(coordinator): reduce task over-decomposition',
  pr_body: '## Summary\n- fix over-decomposition',
  wiki_entry: 'Found planning inefficiency.',
});

describe('GoalReviewService', () => {
  let service: GoalReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalReviewService,
        { provide: ShellExecService, useValue: mockShell },
        { provide: TraceService, useValue: mockTrace },
        { provide: McpFilesystemClient, useValue: mockMcp },
        { provide: LoggingClient, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(GoalReviewService);
    jest.clearAllMocks();
  });

  it('logs cc_review_ok and skips gh calls when verdict is ok', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue(makeTrace());
    mockMcp.readFile.mockResolvedValue('content');
    mockShell.run
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: JSON.stringify(makeOkReview()), stderr: '' })  // CC subprocess
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: '', stderr: '' });  // wiki update

    await service.review(makeInput());

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_ok');
    // gh issue create should NOT be called
    const ghCalls = mockShell.run.mock.calls.filter((c: any[]) => String(c[0]).includes('gh issue'));
    expect(ghCalls).toHaveLength(0);
  });

  it('calls gh issue create and gh pr create when verdict is needs_improvement', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue(makeTrace());
    mockMcp.readFile.mockResolvedValue('content');
    mockShell.run
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: JSON.stringify(makeImprovementReview()), stderr: '' })  // CC
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: 'https://github.com/issues/1', stderr: '' })  // gh issue
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: 'https://github.com/pull/2', stderr: '' })   // gh pr
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: '', stderr: '' });  // wiki

    await service.review(makeInput());

    const shellCalls = mockShell.run.mock.calls.map((c: any[]) => String(c[0]));
    expect(shellCalls.some(c => c.includes('gh issue create'))).toBe(true);
    expect(shellCalls.some(c => c.includes('gh pr create'))).toBe(true);
  });

  it('does not throw when CC subprocess fails — logs cc_review_error', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue(makeTrace());
    mockMcp.readFile.mockResolvedValue('content');
    mockShell.run.mockResolvedValue({ success: false, exitCode: 1, stdout: '', stderr: 'crash' });

    await expect(service.review(makeInput())).resolves.not.toThrow();

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_error');
  });

  it('skips review and logs cc_review_skipped_empty_trace when trace has no tasks', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue({ ...makeTrace(), batches: [], unbatched: [] });
    mockMcp.readFile.mockResolvedValue('content');

    await service.review(makeInput());

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_skipped_empty_trace');
    expect(mockShell.run).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest goal-review.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `GoalReviewService` not found.

- [ ] **Step 3: Implement `GoalReviewService`**

Create `src/goal-review/goal-review.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { TraceService } from '../trace/trace.service';
import { McpFilesystemClient } from '../mcp-client/mcp-filesystem.client';
import { LoggingClient } from '../common/logging/logging.client';

export interface GoalReviewInput {
  goalId: string;
  projectId: string;
  projectSlug: string;
}

interface CcFinding {
  severity: 'high' | 'medium' | 'low';
  area: 'planning' | 'execution' | 'validation' | 'prompts';
  description: string;
  evidence: string;
}

interface CcProposedChange {
  file: string;
  description: string;
  diff_hint: string;
}

interface CcReviewResponse {
  verdict: 'ok' | 'needs_improvement';
  summary: string;
  cc_approach: string;
  findings: CcFinding[];
  proposed_changes: CcProposedChange[];
  pr_title: string;
  pr_body: string;
  wiki_entry: string;
}

@Injectable()
export class GoalReviewService {
  private readonly cliPath: string;
  private readonly timeoutMs: number;
  private readonly githubRepo: string;
  private readonly promptTemplate: string;

  constructor(
    private readonly shell: ShellExecService,
    private readonly trace: TraceService,
    private readonly mcpFs: McpFilesystemClient,
    private readonly logger: LoggingClient,
    private readonly config: ConfigService,
  ) {
    this.cliPath = this.config.get<string>('ccAgent.cliPath') ?? 'claude';
    this.timeoutMs = this.config.get<number>('ccAgent.timeoutMs') ?? 120_000;
    this.githubRepo = this.config.get<string>('ccAgent.githubRepo') ?? '';
    const tplPath = path.join(process.cwd(), 'docs/agents/cc-review-prompt.md');
    this.promptTemplate = fs.existsSync(tplPath) ? fs.readFileSync(tplPath, 'utf-8') : '';
  }

  async review(input: GoalReviewInput): Promise<void> {
    try {
      await this.runReview(input);
    } catch (err) {
      await this.logger.log({
        level: 'error', msg: 'cc_review_error',
        projectId: input.projectId, durationMs: 0,
        metadata: { goalId: input.goalId, error: String(err) },
      });
    }
  }

  private async runReview(input: GoalReviewInput): Promise<void> {
    const goalTrace = await this.trace.buildGoalTrace(input.goalId);

    const totalTasks = goalTrace.batches.reduce((n, b) => n + b.tasks.length, 0) + goalTrace.unbatched.length;
    if (totalTasks === 0) {
      await this.logger.log({
        level: 'info', msg: 'cc_review_skipped_empty_trace',
        projectId: input.projectId, durationMs: 0,
        metadata: { goalId: input.goalId },
      });
      return;
    }

    let specContent = '';
    let planContent = '';
    try {
      specContent = await this.mcpFs.readFile(`${input.projectSlug}/SPEC.md`);
    } catch { /* non-critical */ }
    try {
      planContent = await this.mcpFs.readFile(`${input.projectSlug}/PLAN.md`);
    } catch { /* non-critical */ }

    const prompt = this.buildPrompt(input, specContent, planContent, goalTrace);
    const tmpFile = path.join(os.tmpdir(), `cc-review-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    let ccResult: { success: boolean; exitCode: number; stdout: string; stderr: string };
    try {
      ccResult = await this.shell.run(
        `${this.cliPath} --print < ${tmpFile}`,
        { timeoutMs: this.timeoutMs },
      );
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }

    if (!ccResult.success) {
      throw new Error(`cc subprocess exited ${ccResult.exitCode}: ${ccResult.stderr.slice(0, 200)}`);
    }

    let review: CcReviewResponse;
    try {
      const clean = this.extractJson(ccResult.stdout);
      review = JSON.parse(clean) as CcReviewResponse;
    } catch {
      throw new Error(`cc_review_invalid_json: ${ccResult.stdout.slice(0, 200)}`);
    }

    if (review.verdict === 'needs_improvement') {
      await this.createGithubIssue(input, review);
      await this.createGithubPr(input, review);
    }

    await this.appendWikiEntry(input, review);

    await this.logger.log({
      level: 'info',
      msg: review.verdict === 'ok' ? 'cc_review_ok' : 'cc_review_needs_improvement',
      projectId: input.projectId, durationMs: 0,
      metadata: {
        goalId: input.goalId,
        verdict: review.verdict,
        findings_count: review.findings.length,
        summary: review.summary,
      },
    });
  }

  private async createGithubIssue(input: GoalReviewInput, review: CcReviewResponse): Promise<void> {
    if (!this.githubRepo) return;

    const findingsList = review.findings
      .map(f => `- **[${f.severity}]** ${f.area}: ${f.description} _(${f.evidence})_`)
      .join('\n');

    const changesList = review.proposed_changes
      .map(c => `- \`${c.file}\`: ${c.description}\n  > ${c.diff_hint}`)
      .join('\n');

    const body = `## Goal\n${review.summary}\n\n## What CC Would Have Done Differently\n${review.cc_approach}\n\n## Findings\n${findingsList || '_none_'}\n\n## Proposed Changes\n${changesList || '_none_'}`;

    const title = `[CC Review] ${input.projectSlug}: needs_improvement`;

    const cmd = `gh issue create --repo ${this.githubRepo} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label cc-review,automated`;

    try {
      await this.shell.run(cmd, { timeoutMs: 30_000 });
    } catch (err) {
      await this.logger.log({
        level: 'warn', msg: 'cc_gh_issue_failed',
        projectId: input.projectId, durationMs: 0,
        metadata: { error: String(err) },
      });
    }
  }

  private async createGithubPr(input: GoalReviewInput, review: CcReviewResponse): Promise<void> {
    if (!this.githubRepo || !review.pr_title) return;

    const cmd = `gh pr create --repo ${this.githubRepo} --title ${JSON.stringify(review.pr_title)} --body ${JSON.stringify(review.pr_body)} --label cc-review,automated`;

    try {
      await this.shell.run(cmd, { timeoutMs: 30_000 });
    } catch (err) {
      await this.logger.log({
        level: 'warn', msg: 'cc_gh_pr_failed',
        projectId: input.projectId, durationMs: 0,
        metadata: { error: String(err) },
      });
    }
  }

  private async appendWikiEntry(input: GoalReviewInput, review: CcReviewResponse): Promise<void> {
    if (!this.githubRepo) return;

    const date = new Date().toISOString().slice(0, 10);
    const entry = `\n\n## ${date} — ${input.projectSlug}: "${input.goalId}" — ${review.verdict}\n\n${review.wiki_entry}`;

    const tmpWiki = path.join(os.tmpdir(), `cc-wiki-${Date.now()}.md`);
    fs.writeFileSync(tmpWiki, entry, 'utf-8');

    const cmd = `gh api repos/${this.githubRepo}/contents/CC-Review-Log.md --method GET 2>/dev/null | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(d['sha'])" | xargs -I SHA gh api repos/${this.githubRepo}/contents/CC-Review-Log.md --method PUT -f message="cc-review: append ${date}" -f content="$(base64 -w0 ${tmpWiki})" -f sha=SHA 2>/dev/null || true`;

    try {
      await this.shell.run(cmd, { timeoutMs: 30_000 });
    } catch (err) {
      await this.logger.log({
        level: 'warn', msg: 'cc_wiki_failed',
        projectId: input.projectId, durationMs: 0,
        metadata: { error: String(err) },
      });
    } finally {
      try { fs.unlinkSync(tmpWiki); } catch { /* ignore */ }
    }
  }

  private buildPrompt(
    input: GoalReviewInput,
    specContent: string,
    planContent: string,
    trace: unknown,
  ): string {
    const traceStr = JSON.stringify(trace, null, 2).slice(0, 12000);
    return (this.promptTemplate || this.defaultTemplate())
      .replace('{{GOAL_TITLE}}', (trace as any).title ?? input.goalId)
      .replace('{{GOAL_DESCRIPTION}}', (trace as any).description ?? '')
      .replace('{{PROJECT_SLUG}}', input.projectSlug)
      .replace('{{SPEC_CONTENT}}', specContent.slice(0, 4000))
      .replace('{{PLAN_CONTENT}}', planContent.slice(0, 4000))
      .replace('{{TRACE_JSON}}', traceStr);
  }

  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) return trimmed;
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
  }

  private defaultTemplate(): string {
    return `You are reviewing a completed goal in the business-orchestrator.
Goal: {{GOAL_TITLE}}
Description: {{GOAL_DESCRIPTION}}
Project: {{PROJECT_SLUG}}
SPEC: {{SPEC_CONTENT}}
PLAN: {{PLAN_CONTENT}}
Trace: {{TRACE_JSON}}
Return JSON: {"verdict":"ok|needs_improvement","summary":"...","cc_approach":"...","findings":[...],"proposed_changes":[...],"pr_title":"...","pr_body":"...","wiki_entry":"..."}`;
  }
}
```

- [ ] **Step 4: Create the module**

Create `src/goal-review/goal-review.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalReviewService } from './goal-review.service';
import { CodingWorkerModule } from '../coding-worker/coding-worker.module';
import { TraceModule } from '../trace/trace.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { LoggingClient } from '../common/logging/logging.client';
import { Goal } from '../goals/goal.entity';
import { Task } from '../tasks/task.entity';
import { Execution } from '../executions/execution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goal, Task, Execution]),
    CodingWorkerModule,
    TraceModule,
    McpClientModule,
  ],
  providers: [GoalReviewService, LoggingClient],
  exports: [GoalReviewService],
})
export class GoalReviewModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest goal-review.service.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/goal-review/
git commit -m "feat(cc-loop): add GoalReviewService with trace fetch, CC subprocess, GH issue/PR, wiki"
```

---

## Task 5: Wire modules into `AppModule` and `CoordinatorModule`

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/coordinator/coordinator.module.ts`
- Modify: `src/coordinator/project-coordinator.service.ts`

- [ ] **Step 1: Add imports to `AppModule`**

In `src/app.module.ts`, add two imports after `import { MetricsModule }`:

```typescript
import { CcPlannerModule } from './cc-planner/cc-planner.module';
import { GoalReviewModule } from './goal-review/goal-review.module';
```

And add both to the `imports` array (after `MetricsModule`):

```typescript
    CcPlannerModule,
    GoalReviewModule,
```

- [ ] **Step 2: Update `CoordinatorModule`**

In `src/coordinator/coordinator.module.ts`, add imports:

```typescript
import { CcPlannerModule } from '../cc-planner/cc-planner.module';
import { GoalReviewModule } from '../goal-review/goal-review.module';
```

Add both to the `imports` array:

```typescript
  imports: [ProjectsModule, TasksModule, AgentsModule, forwardRef(() => GoalsModule), CcPlannerModule, GoalReviewModule],
```

- [ ] **Step 3: Inject new services into `ProjectCoordinatorService`**

In `src/coordinator/project-coordinator.service.ts`, add two imports after the existing `DashboardGateway` import:

```typescript
import { CcPlannerService } from '../cc-planner/cc-planner.service';
import { GoalReviewService } from '../goal-review/goal-review.service';
```

Extend the constructor (add after `private readonly configService: ConfigService`):

```typescript
    private readonly ccPlanner: CcPlannerService,
    private readonly goalReview: GoalReviewService,
```

- [ ] **Step 4: Add CC planning branch in `runCycle`**

In `src/coordinator/project-coordinator.service.ts`, find the block that starts with `const COORD_SYSTEM = ...` (around line 131). Insert before it:

```typescript
      // CC Planning branch — optional, falls back to LiteLLM on any error
      if (this.configService.get<boolean>('ccAgent.planningEnabled')) {
        try {
          let specFull = '';
          let planFull = '';
          try { specFull = await this.mcpFs.readFile(`${docsRoot}/SPEC.md`); } catch { /* non-critical */ }
          try { planFull = await this.mcpFs.readFile(`${docsRoot}/PLAN.md`); } catch { /* non-critical */ }

          const ccOutput = await this.ccPlanner.plan({
            projectId,
            projectSlug: project.slug,
            goal: {
              id: activeGoal.id,
              title: activeGoal.title,
              constraints: activeGoal.constraints,
              specReference: activeGoal.specReference,
              planReference: activeGoal.planReference,
              completionPct: activeGoal.completionPct,
            },
            state: project.stateSnapshot ?? {},
            availableWorkers: idleWorkers.length,
            openTasks: openTasks.map(t => `${t.type}: ${t.id}`),
            failedTasks: failedLastCycle.map(t => `${t.type}: ${t.blockedReason ?? 'unknown'}`),
            specContent: specFull,
            planContent: planFull,
          });

          await this.logger.log({
            level: 'info', msg: 'cc_planner_used',
            projectId, durationMs: 0,
            metadata: { tasks_proposed: ccOutput.new_tasks.length, decisions: ccOutput.decisions },
          });

          // Use CC output directly — skip LiteLLM call below
          const normalizedTasks = ccOutput.new_tasks
            .map((s) => this.normalizeCoordinatorTaskSpec(s))
            .filter((s): s is NonNullable<typeof s> => s !== null);

          const availableSlots = this.budget.availableTaskSlots(activeTaskCount, maxConcurrent);
          const policyMax = await this.policy.maxTasksPerCycle(projectId);
          const effectiveMax = Math.min(availableSlots, policyMax);
          const policyAllowed: typeof normalizedTasks = [];
          for (const taskSpec of normalizedTasks) {
            const check = await this.policy.checkTaskType(projectId, taskSpec.type);
            if (check.allowed) policyAllowed.push(taskSpec);
          }
          const tasksToCreate = policyAllowed.slice(0, effectiveMax);
          const cycleBatchId = uuidv4();
          const batchContextRef = {
            cycle_number: (project.stateSnapshot?.cycle ?? 0) + 1,
            goal_ref: null,
            project_slug: project.slug,
            batch_task_count: tasksToCreate.length,
          };

          let tasksCreated = 0;
          for (const taskSpec of tasksToCreate) {
            try {
              const createdTask = await this.tasksService.create({
                projectId,
                goalId: activeGoal.id,
                type: taskSpec.type,
                payloadRef: taskSpec.payload_ref,
                acceptanceCriteria: taskSpec.acceptance_criteria,
                priority: taskSpec.priority,
                maxAttempts: taskSpec.max_attempts,
                batchId: cycleBatchId,
                batchContextRef,
                specSectionAnchor: taskSpec.spec_section_anchor,
                planReference: taskSpec.plan_reference,
                targetService: taskSpec.target_service ?? undefined,
                smokeTestUrls: taskSpec.smoke_test_urls.length > 0 ? taskSpec.smoke_test_urls : undefined,
              });
              if (!(createdTask as any).__idempotentHit) tasksCreated++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await this.logger.log({ level: 'warn', msg: 'task_create_failed', projectId, durationMs: 0, metadata: { type: taskSpec.type, detail: msg.slice(0, 400) } });
            }
          }

          const goalCounts = await this.tasksService.countByGoal(activeGoal.id);
          await this.goalsService.recalcProgress(activeGoal.id, goalCounts.total, goalCounts.done);
          await this.autoAdvanceGoalIfComplete(projectId, activeGoal.id, tasksCreated, openTasks.length, failedLastCycle.length);

          const cycleNumber = (project.stateSnapshot?.cycle ?? 0) + 1;
          const health = this.computeHealth(goalCounts.failed, openTasks.length + tasksCreated, tasksCreated);
          const mergedPatch = { ...ccOutput.state_patch, cycle: cycleNumber, last_cycle_at: new Date().toISOString(), tasks_active: openTasks.length + tasksCreated, health };
          const updated = await this.projectsService.applyStatePatch(projectId, mergedPatch);
          try { await this.mcpFs.writeFile(`${docsRoot}/STATE.json`, JSON.stringify(updated.stateSnapshot, null, 2)); } catch { /* non-critical */ }

          const durationMs = Date.now() - cycleStart;
          await this.events.publish('cycle.completed', { project_id: projectId, tasks_created: tasksCreated, duration_ms: durationMs });
          await this.logger.log({ level: 'info', msg: 'cycle_completed', projectId, durationMs, metadata: { tasks_created: tasksCreated, cycle: cycleNumber, planner: 'cc' } });
          return { tasksCreated, cycleNumber };
        } catch (err) {
          await this.logger.log({
            level: 'warn', msg: 'cc_planner_fallback',
            projectId, durationMs: 0,
            metadata: { error: String(err) },
          });
          // Fall through to LiteLLM path below
        }
      }
```

- [ ] **Step 5: Add review trigger in `autoAdvanceGoalIfComplete`**

In `src/coordinator/project-coordinator.service.ts`, find `autoAdvanceGoalIfComplete`. After the line `await this.events.publish('goal.auto_completed', ...)` (around line 512), add:

```typescript
    // Fire-and-forget CC review — never blocks next goal activation
    if (this.configService.get<boolean>('ccAgent.reviewEnabled')) {
      this.goalReview.review({ goalId, projectId, projectSlug: project?.slug ?? projectId })
        .catch((err) => this.logger.log({ level: 'warn', msg: 'cc_review_fire_forget_error', projectId, durationMs: 0, metadata: { error: String(err) } }).catch(() => {}));
    }
```

Note: `autoAdvanceGoalIfComplete` does not currently receive `project` — pass it through or resolve via `projectsService`. The cleanest approach: add `project: Project` as a parameter to the method, and update the one call-site at line ~303 to pass `project`.

Change the method signature from:
```typescript
  private async autoAdvanceGoalIfComplete(
    projectId: string,
    goalId: string,
    tasksCreated: number,
    openTasksCount: number,
    failedTasksCount: number,
  ): Promise<void> {
```

To:
```typescript
  private async autoAdvanceGoalIfComplete(
    projectId: string,
    goalId: string,
    tasksCreated: number,
    openTasksCount: number,
    failedTasksCount: number,
    project?: Project,
  ): Promise<void> {
```

And update the call-site (line ~303) to pass `project`:
```typescript
      await this.autoAdvanceGoalIfComplete(
        projectId,
        activeGoal.id,
        tasksCreated,
        openTasks.length,
        failedLastCycle.length,
        project,
      );
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Run all tests**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest --no-coverage 2>&1 | tail -30
```

Expected: all existing tests pass, new tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app.module.ts src/coordinator/coordinator.module.ts src/coordinator/project-coordinator.service.ts
git commit -m "feat(cc-loop): wire CcPlannerService and GoalReviewService into ProjectCoordinator"
```

---

## Task 6: Environment variable documentation

**Files:**
- Modify: `CLAUDE.md` (project CLAUDE.md at `/home/ssf/Documents/Github/business-orchestrator/CLAUDE.md`)

- [ ] **Step 1: Add CC env vars to CLAUDE.md**

In `CLAUDE.md`, find the table under `### Coding Worker Agent env` and add a new section after it:

```markdown
### Claude Code Intelligence Loop env

| Variable | Purpose |
|----------|---------|
| `CC_PLANNING_ENABLED` | Set `true` to route planning through Claude Code instead of LiteLLM (default: `false`) |
| `CC_REVIEW_ENABLED` | Set `false` to disable post-goal CC review (default: `true`) |
| `CC_CLI_PATH` | Path to the claude CLI binary (default: `claude`) |
| `CC_CLI_TIMEOUT_MS` | Max ms for any CC subprocess call (default: `120000`) |
| `GITHUB_REPO` | Repo slug for gh CLI calls, e.g. `speakASAP/business-orchestrator` |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(cc-loop): document CC intelligence loop env vars in CLAUDE.md"
```

---

## Task 7: Smoke test — end-to-end wiring check

**Files:** (no new files — this task is verification only)

- [ ] **Step 1: Build the service**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npm run build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 2: Run full test suite**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass (no regressions).

- [ ] **Step 3: Verify CC CLI is accessible**

```bash
which claude && claude --version
```

Expected: path printed, version string returned.

- [ ] **Step 4: Verify gh CLI is accessible**

```bash
which gh && gh --version
```

Expected: path printed, version string returned.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(cc-loop): complete Claude Code intelligence loop implementation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `CcPlannerService` spawns subprocess | Task 3 |
| `GoalReviewService` fetches trace + spawns CC | Task 4 |
| GH issue created on `needs_improvement` | Task 4, step 3 (`createGithubIssue`) |
| GH PR created on `needs_improvement` | Task 4, step 3 (`createGithubPr`) |
| Wiki entry appended after every review | Task 4, step 3 (`appendWikiEntry`) |
| CC planning branch in `ProjectCoordinator` | Task 5, step 4 |
| Fire-and-forget review after goal completes | Task 5, step 5 |
| Fallback to LiteLLM if CC planner fails | Task 5, step 4 (catch block) |
| `CC_PLANNING_ENABLED`, `CC_REVIEW_ENABLED` env vars | Task 1, Task 6 |
| Prompt templates | Task 2 |
| All errors non-blocking | Task 4 (`review()` catches everything), Task 5 (fire-and-forget) |
| Unit tests for both services | Tasks 3, 4 |
| TypeScript compile verification | Tasks 1, 5, 7 |
| Env var docs | Task 6 |

**Placeholder scan:** No TBDs, all code blocks complete, all paths exact.

**Type consistency:** `CcPlannerOutput.new_tasks` items match `normalizeCoordinatorTaskSpec` input shape (uses same fields: `type`, `idempotency_key`, `payload_ref`, etc.). `GoalReviewInput` fields match usage in `autoAdvanceGoalIfComplete`. `TraceService.buildGoalTrace` signature matches Task 4 usage. ✓
