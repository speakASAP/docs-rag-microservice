# Route All AI Through ai-microservice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `CcPlannerService` and `GoalReviewService` to call `AiHttpClient` instead of invoking CC CLI directly, so all AI inference in business-orchestrator routes through `ai-microservice POST /ai/complete`.

**Architecture:** Both services currently write a prompt to a tmp file and shell-exec `claude --print < tmpFile`. They will instead inject `AiHttpClient` and call `.call({model_tier, user_prompt, output_schema, ...})`. The prompt-building logic is unchanged; only the execution path changes. `CodingWorkerModule` already provides `AiHttpClient` and is already imported by both modules — it just needs to export `AiHttpClient`.

**Tech Stack:** NestJS, TypeScript, Jest. Key files: `src/cc-planner/cc-planner.service.ts`, `src/goal-review/goal-review.service.ts`, `src/coding-worker/coding-worker.module.ts`, `src/cc-planner/cc-planner.module.ts`, `src/goal-review/goal-review.module.ts`, plus their spec files.

---

## File Map

| File | Change |
|---|---|
| `src/coding-worker/coding-worker.module.ts` | Add `AiHttpClient` to `exports` |
| `src/cc-planner/cc-planner.service.ts` | Replace CLI path with `AiHttpClient` |
| `src/cc-planner/cc-planner.module.ts` | No change needed (already imports `CodingWorkerModule`) |
| `src/cc-planner/cc-planner.service.spec.ts` | Replace `ShellExecService` mock with `AiHttpClient` mock |
| `src/goal-review/goal-review.service.ts` | Replace CLI path with `AiHttpClient` |
| `src/goal-review/goal-review.module.ts` | No change needed (already imports `CodingWorkerModule`) |
| `src/goal-review/goal-review.service.spec.ts` | Replace CLI mock with `AiHttpClient` mock |

---

### Task 1: Export AiHttpClient from CodingWorkerModule

**Files:**
- Modify: `src/coding-worker/coding-worker.module.ts`

`CodingWorkerModule` already provides `AiHttpClient` but doesn't export it. Both `CcPlannerModule` and `GoalReviewModule` import `CodingWorkerModule` — adding `AiHttpClient` to exports makes it available in both.

- [ ] **Step 1: Add AiHttpClient to CodingWorkerModule exports**

Replace the `exports` line in `src/coding-worker/coding-worker.module.ts`:

```typescript
// Before:
exports: [CodingWorkerAgentService, ShellExecService],

// After:
exports: [CodingWorkerAgentService, ShellExecService, AiHttpClient],
```

Full file after change:
```typescript
import { Module } from '@nestjs/common';
import { ShellExecService } from './shell-exec.service';
import { CodingWorkerAgentService } from './coding-worker-agent.service';
import { AiHttpClient } from '../worker/ai-http.client';
import { TasksModule } from '../tasks/tasks.module';
import { AgentsModule } from '../agents/agents.module';
import { ExecutionsModule } from '../executions/executions.module';
import { LoggingClient } from '../common/logging/logging.client';

@Module({
  imports: [TasksModule, AgentsModule, ExecutionsModule],
  providers: [LoggingClient, AiHttpClient, ShellExecService, CodingWorkerAgentService],
  exports: [CodingWorkerAgentService, ShellExecService, AiHttpClient],
})
export class CodingWorkerModule {}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or same errors as before this change).

- [ ] **Step 3: Commit**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
git add src/coding-worker/coding-worker.module.ts
git commit -m "feat: export AiHttpClient from CodingWorkerModule"
```

---

### Task 2: Refactor CcPlannerService — update tests first (TDD)

**Files:**
- Modify: `src/cc-planner/cc-planner.service.spec.ts`
- Modify: `src/cc-planner/cc-planner.service.ts`

- [ ] **Step 1: Write the updated spec (replace ShellExecService mock with AiHttpClient mock)**

Replace the entire contents of `src/cc-planner/cc-planner.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CcPlannerService, CcPlannerInput } from './cc-planner.service';
import { AiHttpClient } from '../worker/ai-http.client';
import { LoggingClient } from '../common/logging/logging.client';

const mockAiHttp = { call: jest.fn() };
const mockLogger = { log: jest.fn().mockResolvedValue(undefined) };

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
        { provide: AiHttpClient, useValue: mockAiHttp },
        { provide: LoggingClient, useValue: mockLogger },
      ],
    }).compile();
    service = module.get(CcPlannerService);
    jest.clearAllMocks();
  });

  it('returns parsed coordinator output on valid AI response', async () => {
    mockAiHttp.call.mockResolvedValue({
      new_tasks: [{ type: 'coding', idempotency_key: 'add-health', payload_ref: { description: 'edit health.ts' }, acceptance_criteria: ['returns 200'], priority: 2, max_attempts: 3, target_service: 'my-service', smoke_test_urls: [] }],
      state_patch: {},
      decisions: ['first task'],
      text: '',
      model_used: 'claude-sonnet',
      inputTokens: 100,
      outputTokens: 50,
      token_usage_estimate: 150,
    });

    const result = await service.plan(makeInput());

    expect(result.new_tasks).toHaveLength(1);
    expect(result.new_tasks[0].idempotency_key).toBe('add-health');
    expect(result.decisions).toEqual(['first task']);
  });

  it('throws cc_planner_ai_error when AiHttpClient returns error_code', async () => {
    mockAiHttp.call.mockResolvedValue({ error_code: 'WORKER_TIMEOUT', text: '', model_used: 'claude-sonnet', token_usage_estimate: 0 });

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_ai_error');
  });

  it('throws cc_planner_invalid_json when response has no new_tasks', async () => {
    mockAiHttp.call.mockResolvedValue({
      state_patch: {},
      decisions: [],
      text: '{}',
      model_used: 'claude-sonnet',
      token_usage_estimate: 0,
    });

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_invalid_json');
  });

  it('throws cc_planner_ai_error when AiHttpClient throws', async () => {
    mockAiHttp.call.mockRejectedValue(new Error('network error'));

    await expect(service.plan(makeInput())).rejects.toThrow('cc_planner_ai_error');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail (CcPlannerService still has old implementation)**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest cc-planner --no-coverage 2>&1 | tail -20
```

Expected: tests fail with errors like "Cannot find module" or provider injection errors.

- [ ] **Step 3: Rewrite CcPlannerService to use AiHttpClient**

Replace the entire contents of `src/cc-planner/cc-planner.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggingClient } from '../common/logging/logging.client';
import { AiHttpClient } from '../worker/ai-http.client';

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
  constructor(
    private readonly aiHttp: AiHttpClient,
    private readonly logger: LoggingClient,
  ) {}

  async plan(input: CcPlannerInput): Promise<CcPlannerOutput> {
    const prompt = this.buildPrompt(input);

    let response: Record<string, unknown>;
    try {
      response = await this.aiHttp.call({
        model_tier: 'smart',
        user_prompt: prompt,
        output_schema: {
          type: 'object',
          required: ['new_tasks', 'state_patch', 'decisions'],
          properties: {
            new_tasks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type', 'idempotency_key', 'payload_ref', 'acceptance_criteria', 'priority', 'max_attempts', 'target_service', 'smoke_test_urls'],
              },
            },
            state_patch: { type: 'object' },
            decisions: { type: 'array', items: { type: 'string' } },
          },
        },
        max_tokens: 4000,
        correlation_id: input.projectId,
      }) as Record<string, unknown>;
    } catch (err) {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_ai_error',
        projectId: input.projectId, durationMs: 0,
        metadata: { error: String(err).slice(0, 300) },
      });
      throw new Error('cc_planner_ai_error');
    }

    if (response['error_code']) {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_ai_error',
        projectId: input.projectId, durationMs: 0,
        metadata: { error_code: response['error_code'] },
      });
      throw new Error('cc_planner_ai_error');
    }

    if (!Array.isArray(response['new_tasks'])) {
      await this.logger.log({
        level: 'warn', msg: 'cc_planner_invalid_json',
        projectId: input.projectId, durationMs: 0,
        metadata: { response_keys: Object.keys(response).slice(0, 10) },
      });
      throw new Error('cc_planner_invalid_json');
    }

    return {
      new_tasks: response['new_tasks'] as CcPlannerOutput['new_tasks'],
      state_patch: (response['state_patch'] as Record<string, unknown>) ?? {},
      decisions: Array.isArray(response['decisions']) ? response['decisions'] as string[] : [],
    };
  }

  private buildPrompt(input: CcPlannerInput): string {
    const template = this.defaultTemplate();
    return template
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

IMPORTANT COMPLETION RULE:
When completionPct reaches 100 AND open tasks list is empty ("none"), you MUST emit exactly one task as the final task with type "notify" and no other tasks. This signals that the goal is fully complete. Example:
{"new_tasks":[{"type":"notify","idempotency_key":"notify-done","payload_ref":{"message":"Goal completed"},"acceptance_criteria":[],"priority":1,"max_attempts":1,"target_service":"business-orchestrator","smoke_test_urls":[]}],"state_patch":{},"decisions":["Goal reached 100% with no open tasks; emitting notify task."]}

Return JSON only (no markdown): {"new_tasks":[...],"state_patch":{},"decisions":[]}`;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest cc-planner --no-coverage 2>&1 | tail -20
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
git add src/cc-planner/cc-planner.service.ts src/cc-planner/cc-planner.service.spec.ts
git commit -m "feat: route CcPlannerService through ai-microservice instead of CC CLI directly"
```

---

### Task 3: Refactor GoalReviewService — update tests first (TDD)

**Files:**
- Modify: `src/goal-review/goal-review.service.spec.ts`
- Modify: `src/goal-review/goal-review.service.ts`

`GoalReviewService` still needs `ShellExecService` for `gh` shell commands (`createGithubIssue`, `createGithubPr`, `appendWikiEntry`). Only the CC CLI call is replaced by `AiHttpClient`.

- [ ] **Step 1: Write the updated spec**

Replace the entire contents of `src/goal-review/goal-review.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GoalReviewService, GoalReviewInput } from './goal-review.service';
import { AiHttpClient } from '../worker/ai-http.client';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { TraceService } from '../trace/trace.service';
import { McpFilesystemClient } from '../mcp-client/mcp-filesystem.client';
import { LoggingClient } from '../common/logging/logging.client';
import { ConfigService } from '@nestjs/config';

const mockAiHttp = { call: jest.fn() };
const mockShell = { run: jest.fn() };
const mockTrace = { buildGoalTrace: jest.fn() };
const mockMcp = { readFile: jest.fn() };
const mockLogger = { log: jest.fn().mockResolvedValue(undefined) };
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
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
  text: '',
  model_used: 'claude-sonnet',
  token_usage_estimate: 100,
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
  text: '',
  model_used: 'claude-sonnet',
  token_usage_estimate: 100,
});

describe('GoalReviewService', () => {
  let service: GoalReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalReviewService,
        { provide: AiHttpClient, useValue: mockAiHttp },
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
    mockTrace.buildGoalTrace.mockResolvedValue({ ...makeTrace(), unbatched: [{ id: 't-1' }] });
    mockMcp.readFile.mockResolvedValue('content');
    mockAiHttp.call.mockResolvedValue(makeOkReview());
    mockShell.run.mockResolvedValue({ success: true, exitCode: 0, stdout: '', stderr: '' });

    await service.review(makeInput());

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_ok');
    const ghIssueCalls = mockShell.run.mock.calls.filter((c: any[]) => String(c[0]).includes('gh issue'));
    expect(ghIssueCalls).toHaveLength(0);
  });

  it('calls gh issue create and gh pr create when verdict is needs_improvement', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue({ ...makeTrace(), unbatched: [{ id: 't-1' }] });
    mockMcp.readFile.mockResolvedValue('content');
    mockAiHttp.call.mockResolvedValue(makeImprovementReview());
    mockShell.run
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: 'https://github.com/issues/1', stderr: '' })
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: 'https://github.com/pull/2', stderr: '' })
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: '', stderr: '' });

    await service.review(makeInput());

    const shellCalls = mockShell.run.mock.calls.map((c: any[]) => String(c[0]));
    expect(shellCalls.some(c => c.includes('gh issue create'))).toBe(true);
    expect(shellCalls.some(c => c.includes('gh pr create'))).toBe(true);
  });

  it('does not throw when AiHttpClient fails — logs cc_review_error', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue({ ...makeTrace(), unbatched: [{ id: 't-1' }] });
    mockMcp.readFile.mockResolvedValue('content');
    mockAiHttp.call.mockRejectedValue(new Error('network error'));

    await expect(service.review(makeInput())).resolves.not.toThrow();

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_error');
  });

  it('skips review and logs cc_review_skipped_empty_trace when trace has no tasks', async () => {
    mockTrace.buildGoalTrace.mockResolvedValue(makeTrace());
    mockMcp.readFile.mockResolvedValue('content');

    await service.review(makeInput());

    const logCalls = mockLogger.log.mock.calls.map((c: any[]) => c[0].msg);
    expect(logCalls).toContain('cc_review_skipped_empty_trace');
    expect(mockAiHttp.call).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest goal-review --no-coverage 2>&1 | tail -20
```

Expected: tests fail (provider injection errors — `AiHttpClient` not in providers yet).

- [ ] **Step 3: Rewrite GoalReviewService to use AiHttpClient**

Replace the entire contents of `src/goal-review/goal-review.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ShellExecService } from '../coding-worker/shell-exec.service';
import { AiHttpClient } from '../worker/ai-http.client';
import { TraceService, TraceGoal } from '../trace/trace.service';
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
  private readonly githubRepo: string;
  private readonly promptTemplate: string;

  constructor(
    private readonly aiHttp: AiHttpClient,
    private readonly shell: ShellExecService,
    private readonly trace: TraceService,
    private readonly mcpFs: McpFilesystemClient,
    private readonly logger: LoggingClient,
    private readonly config: ConfigService,
  ) {
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
    try { specContent = await this.mcpFs.readFile(`${input.projectSlug}/SPEC.md`); } catch { /* non-critical */ }
    try { planContent = await this.mcpFs.readFile(`${input.projectSlug}/PLAN.md`); } catch { /* non-critical */ }

    const prompt = this.buildPrompt(input, specContent, planContent, goalTrace);

    const response = await this.aiHttp.call({
      model_tier: 'smart',
      user_prompt: prompt,
      output_schema: {
        type: 'object',
        required: ['verdict', 'summary', 'cc_approach', 'findings', 'proposed_changes', 'pr_title', 'pr_body', 'wiki_entry'],
        properties: {
          verdict: { type: 'string', enum: ['ok', 'needs_improvement'] },
          summary: { type: 'string' },
          cc_approach: { type: 'string' },
          findings: { type: 'array' },
          proposed_changes: { type: 'array' },
          pr_title: { type: 'string' },
          pr_body: { type: 'string' },
          wiki_entry: { type: 'string' },
        },
      },
      max_tokens: 2000,
      correlation_id: input.goalId,
    }) as Record<string, unknown>;

    const review: CcReviewResponse = {
      verdict: (response['verdict'] === 'needs_improvement' ? 'needs_improvement' : 'ok') as CcReviewResponse['verdict'],
      summary: String(response['summary'] ?? ''),
      cc_approach: String(response['cc_approach'] ?? ''),
      findings: Array.isArray(response['findings']) ? response['findings'] as CcFinding[] : [],
      proposed_changes: Array.isArray(response['proposed_changes']) ? response['proposed_changes'] as CcProposedChange[] : [],
      pr_title: String(response['pr_title'] ?? ''),
      pr_body: String(response['pr_body'] ?? ''),
      wiki_entry: String(response['wiki_entry'] ?? ''),
    };

    if (review.verdict === 'needs_improvement') {
      await this.createGithubIssue(input, review);
      await this.createGithubPr(input, review);
    }

    await this.appendWikiEntry(input, review);

    await this.logger.log({
      level: 'info',
      msg: review.verdict === 'ok' ? 'cc_review_ok' : 'cc_review_needs_improvement',
      projectId: input.projectId, durationMs: 0,
      metadata: { goalId: input.goalId, verdict: review.verdict, findings_count: review.findings.length, summary: review.summary },
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
      await this.logger.log({ level: 'warn', msg: 'cc_gh_issue_failed', projectId: input.projectId, durationMs: 0, metadata: { error: String(err) } });
    }
  }

  private async createGithubPr(input: GoalReviewInput, review: CcReviewResponse): Promise<void> {
    if (!this.githubRepo || !review.pr_title) return;
    const cmd = `gh pr create --repo ${this.githubRepo} --title ${JSON.stringify(review.pr_title)} --body ${JSON.stringify(review.pr_body)} --label cc-review,automated`;
    try {
      await this.shell.run(cmd, { timeoutMs: 30_000 });
    } catch (err) {
      await this.logger.log({ level: 'warn', msg: 'cc_gh_pr_failed', projectId: input.projectId, durationMs: 0, metadata: { error: String(err) } });
    }
  }

  private async appendWikiEntry(input: GoalReviewInput, review: CcReviewResponse): Promise<void> {
    if (!this.githubRepo) return;
    const date = new Date().toISOString().slice(0, 10);
    const entry = `\n\n## ${date} — ${input.projectSlug}: "${input.goalId}" — ${review.verdict}\n\n${review.wiki_entry}`;
    const tmpWiki = path.join(os.tmpdir(), `cc-wiki-${randomUUID()}.md`);
    fs.writeFileSync(tmpWiki, entry, 'utf-8');
    const cmd = `gh api repos/${this.githubRepo}/contents/CC-Review-Log.md --method GET 2>/dev/null | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(d['sha'])" | xargs -I SHA gh api repos/${this.githubRepo}/contents/CC-Review-Log.md --method PUT -f message="cc-review: append ${date}" -f content="$(base64 -w0 "${tmpWiki}")" -f sha=SHA 2>/dev/null || true`;
    try {
      await this.shell.run(cmd, { timeoutMs: 30_000 });
    } catch (err) {
      await this.logger.log({ level: 'warn', msg: 'cc_wiki_failed', projectId: input.projectId, durationMs: 0, metadata: { error: String(err) } });
    } finally {
      try { fs.unlinkSync(tmpWiki); } catch { /* ignore */ }
    }
  }

  private buildPrompt(
    input: GoalReviewInput,
    specContent: string,
    planContent: string,
    trace: TraceGoal,
  ): string {
    const traceStr = JSON.stringify(trace, null, 2).slice(0, 12000);
    return (this.promptTemplate || this.defaultTemplate())
      .replace('{{GOAL_TITLE}}', trace.title ?? input.goalId)
      .replace('{{GOAL_DESCRIPTION}}', trace.description ?? '')
      .replace('{{PROJECT_SLUG}}', input.projectSlug)
      .replace('{{SPEC_CONTENT}}', specContent.slice(0, 4000))
      .replace('{{PLAN_CONTENT}}', planContent.slice(0, 4000))
      .replace('{{TRACE_JSON}}', traceStr);
  }

  private defaultTemplate(): string {
    return `You are reviewing a completed goal in the business-orchestrator.
Goal: {{GOAL_TITLE}}
Description: {{GOAL_DESCRIPTION}}
Project: {{PROJECT_SLUG}}
SPEC: {{SPEC_CONTENT}}
PLAN: {{PLAN_CONTENT}}
Trace: {{TRACE_JSON}}
Return JSON only (no markdown): {"verdict":"ok|needs_improvement","summary":"...","cc_approach":"...","findings":[...],"proposed_changes":[...],"pr_title":"...","pr_body":"...","wiki_entry":"..."}`;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest goal-review --no-coverage 2>&1 | tail -20
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
git add src/goal-review/goal-review.service.ts src/goal-review/goal-review.service.spec.ts
git commit -m "feat: route GoalReviewService through ai-microservice instead of CC CLI directly"
```

---

### Task 4: Full test suite + TypeScript check

**Files:** (no changes — verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass. If any unrelated tests fail, note them and verify they were already failing before this change.

- [ ] **Step 2: Run TypeScript type check**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors introduced by these changes.

- [ ] **Step 3: Commit if there are any fixup changes**

Only commit if Step 1 or 2 uncovered issues that required fixes. If clean, no commit needed here.
