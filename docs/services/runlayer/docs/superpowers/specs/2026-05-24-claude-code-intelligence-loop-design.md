# Spec: Claude Code Intelligence Loop

**Date**: 2026-05-24
**Status**: Approved
**Author**: speakASAP + Claude Code

---

## Overview

Add Claude Code (CC) as an active intelligence layer inside `runlayer`, operating in two roles:

1. **CC Planning Agent** — optionally replaces LiteLLM for goal → task decomposition inside `ProjectCoordinator`. Claude Code reads the project's SPEC.md, PLAN.md, and current state, then returns a structured DAG of tasks in the same schema the coordinator already uses.

2. **CC Goal Review Agent** — after every goal completes, automatically reviews the full execution trace, compares what actually happened against what Claude Code would have done, and opens a GitHub issue with findings plus a PR with specific code fixes when improvements are identified.

The two roles combine into a **self-improving loop**: better planning → better execution → review catches remaining gaps → PR fixes the orchestrator → next goal is planned better.

---

## Goals

- Give the orchestrator access to a reasoning agent (Claude Code) that can read actual code, not just a text prompt, when decomposing a goal into tasks.
- Create a persistent, automated feedback mechanism so every completed goal produces actionable improvement artifacts (GitHub issue + optional PR).
- Document every review in the GitHub Wiki so the improvement history is human-readable and searchable.
- Require zero new external services — the `claude` CLI binary already exists on the server; `gh` CLI is already available.

---

## Non-Goals

- This spec does not replace `WorkerAgent` or `CodingWorkerAgent` — those remain the executors.
- This spec does not add a budget cap on Claude Code calls (by design — CC calls are outside the LLM unit budget system).
- This spec does not change the ValidatorAgent — validation logic is unchanged.
- No new microservice. Everything lives inside `runlayer`.

---

## Architecture

### New Modules

| Module | Path | Role |
|---|---|---|
| `CcPlannerModule` | `src/cc-planner/` | NestJS module: planning subprocess |
| `GoalReviewModule` | `src/goal-review/` | NestJS module: post-completion review subprocess |

Both modules are registered in `AppModule`. Both use `ShellExecService` (existing) for subprocess management.

### New Services

#### `CcPlannerService` (`src/cc-planner/cc-planner.service.ts`)

Spawns `claude --print` with a planning prompt and returns parsed coordinator output.

**Input:**
```typescript
interface CcPlannerInput {
  projectId: string;
  goal: { id: string; title: string; constraints: string[]; specReference: string | null; planReference: string | null; completionPct: number };
  state: Record<string, unknown>;
  availableWorkers: number;
  openTasks: string[];        // task titles only, for context
  failedTasks: string[];
  specContent: string;        // SPEC.md full text
  planContent: string;        // PLAN.md full text
}
```

**Output:** Same shape as `ProjectCoordinator`'s existing LiteLLM response:
```typescript
interface CoordinatorAiOutput {
  new_tasks: TaskSpec[];
  state_patch: Record<string, unknown>;
  decisions: string[];
}
```

**Fallback:** If the CC subprocess times out, returns non-zero exit code, or produces invalid JSON, `CcPlannerService` throws. `ProjectCoordinator` catches this and falls back to the existing LiteLLM call, logging `cc_planner_fallback`.

---

#### `GoalReviewService` (`src/goal-review/goal-review.service.ts`)

Spawns `claude --print` with a review prompt after a goal completes. Creates GitHub artifacts from the response.

**Input:**
```typescript
interface GoalReviewInput {
  goalId: string;
  projectId: string;
  projectSlug: string;
}
```

**Subprocess flow:**
1. Fetch full goal trace via `TraceService.getGoalTrace(goalId)` — tasks, executions, LLM logs, errors.
2. Fetch SPEC.md + PLAN.md via `McpFilesystemClient`.
3. Build review prompt from `docs/agents/cc-review-prompt.md` template, injecting trace + spec + plan.
4. Spawn `claude --print --model claude-sonnet-4-6 "<prompt>"`.
5. Parse JSON response.
6. If `verdict === 'needs_improvement'`: run `gh issue create` then `gh pr create` via `ShellExecService`.
7. Append entry to GitHub Wiki (`CC-Review-Log` page) via `gh wiki push` or direct API.
8. Log outcome to `logging-microservice`.

**CC response schema:**
```typescript
interface CcReviewResponse {
  verdict: 'ok' | 'needs_improvement';
  summary: string;                      // 2-3 sentence summary of what happened
  cc_approach: string;                  // what CC would have done differently
  findings: Array<{
    severity: 'high' | 'medium' | 'low';
    area: 'planning' | 'execution' | 'validation' | 'prompts';
    description: string;
    evidence: string;                   // specific log/trace reference
  }>;
  proposed_changes: Array<{
    file: string;
    description: string;
    diff_hint: string;                  // what to change and why
  }>;
  pr_title: string;
  pr_body: string;
  wiki_entry: string;                   // markdown snippet for the CC-Review-Log
}
```

---

### Modified: `ProjectCoordinator`

Two changes to `project-coordinator.service.ts`:

**Change 1 — CC planning branch:**

After the lease is acquired and SPEC/PLAN are confirmed present, before calling the LiteLLM AI endpoint:
- If `CC_PLANNING_ENABLED=true`: call `CcPlannerService.plan(input)`. On success use its output as `coordinatorAiOutput`. On failure log `cc_planner_fallback` and proceed with existing LiteLLM call.
- If `CC_PLANNING_ENABLED=false` (default): existing LiteLLM path unchanged.

**Change 2 — trigger review after goal completion:**

In `autoAdvanceGoalIfComplete`, after publishing `goal.auto_completed` and before activating the next goal:
- If `CC_REVIEW_ENABLED=true`: fire-and-forget `this.goalReview.review({ goalId, projectId, projectSlug: project.slug })`. Errors are caught and logged but never block the next goal from activating.

---

### Prompt Templates

#### `docs/agents/cc-planner-prompt.md`

Template variables: `{{GOAL_TITLE}}`, `{{GOAL_CONSTRAINTS}}`, `{{COMPLETION_PCT}}`, `{{SPEC_CONTENT}}`, `{{PLAN_CONTENT}}`, `{{STATE_JSON}}`, `{{AVAILABLE_WORKERS}}`, `{{OPEN_TASKS}}`, `{{FAILED_TASKS}}`.

The prompt instructs Claude Code to:
- Read the SPEC and PLAN as the authoritative source of truth
- Identify the next highest-value increment of work given current state
- Return exactly the JSON schema: `{ new_tasks, state_patch, decisions }`
- Never create more tasks than `AVAILABLE_WORKERS`
- Prefer small, independently deployable tasks

#### `docs/agents/cc-review-prompt.md`

Template variables: `{{GOAL_TITLE}}`, `{{GOAL_DESCRIPTION}}`, `{{SPEC_CONTENT}}`, `{{PLAN_CONTENT}}`, `{{TRACE_JSON}}`.

The prompt instructs Claude Code to:
- Act as a senior engineer doing a post-mortem review
- Compare what the orchestrator actually did against what it should have done
- Be specific — cite exact log entries, task IDs, or LLM outputs as evidence
- Return the `CcReviewResponse` JSON schema
- Keep `pr_body` actionable: bullet points, file names, and why each change matters
- Keep `wiki_entry` concise: one paragraph max

---

## GitHub Documentation Loop

Every completed goal produces the following artifacts, whether or not improvements are found:

### GitHub Issue (always)

Created by `gh issue create` with labels `cc-review`, `automated`:

```
Title: [CC Review] <goal title> — <verdict>
Body:
  ## Goal
  <goal title> | Project: <slug> | Completed: <date>

  ## Verdict
  ok | needs_improvement

  ## Summary
  <cc.summary>

  ## What CC Would Have Done Differently
  <cc.cc_approach>

  ## Findings
  <cc.findings as bullet list with severity badges>

  ## Proposed Changes
  <cc.proposed_changes — file, description, diff_hint>

  ## Links
  - Trace: https://runlayer.alfares.cz/dashboard/goals/<goalId>
  - PR: <gh pr url if created>
```

### GitHub PR (when `verdict === 'needs_improvement'`)

Created by `gh pr create` targeting `main`. The PR contains only changes to:
- Prompt files (`docs/agents/*.md`)
- Orchestrator service files (`src/**/*.ts`)
- Config/env documentation (`CLAUDE.md`, `docs/`)

The PR is **never** auto-merged. A human reviews and merges it. This is the human-in-the-loop gate.

### GitHub Wiki — `CC-Review-Log`

A running log page on the repo wiki. `GoalReviewService` appends one entry per review:

```markdown
## 2026-05-24 — speakasap: "Add user onboarding flow" — needs_improvement

**Verdict**: needs_improvement
**PR**: #42
**Summary**: The orchestrator created 4 tasks where CC would have created 2 broader tasks,
leading to 3 unnecessary coordinator cycles and a planning inefficiency in the coding prompt.
```

---

## New Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `CC_PLANNING_ENABLED` | `false` | Route planning through Claude Code instead of LiteLLM |
| `CC_REVIEW_ENABLED` | `true` | Run CC review after every goal completion |
| `CC_CLI_PATH` | `claude` | Absolute or relative path to the claude CLI binary |
| `CC_CLI_TIMEOUT_MS` | `120000` | Max milliseconds for any CC subprocess call |
| `GITHUB_REPO` | _(required)_ | Repo slug for gh CLI calls, e.g. `speakASAP/runlayer` |

All vars added to `docs/` and the project's `external-secret.yaml`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| CC subprocess times out | Log `cc_timeout`, continue with LiteLLM (planning) or skip review (review) |
| CC returns invalid JSON | Log `cc_invalid_json` with raw output preview, fall back / skip |
| `gh issue create` fails | Log `cc_gh_issue_failed`, do not retry, continue |
| `gh pr create` fails | Log `cc_gh_pr_failed`, findings still written to issue |
| Wiki update fails | Log `cc_wiki_failed`, non-blocking |
| `TraceService` returns empty | Log `cc_review_skipped_empty_trace`, skip |
| `GoalReviewService` throws | Caught in `ProjectCoordinator`, logged as `cc_review_error`, next goal activation proceeds normally |

---

## Testing

- **Unit tests** for `CcPlannerService`: mock `ShellExecService`, test valid JSON path, fallback on timeout, fallback on invalid JSON.
- **Unit tests** for `GoalReviewService`: mock `TraceService`, `McpFilesystemClient`, `ShellExecService`; test both verdict paths; test gh CLI invocations.
- **Integration test** for `ProjectCoordinator` with `CC_PLANNING_ENABLED=true`: mock `CcPlannerService`, verify tasks are created from CC output and LiteLLM is not called.
- **E2E smoke test** (`orch-test-ai.sh` extended): add a `cc` mode that calls `CcPlannerService` with a synthetic goal and asserts valid task JSON is returned.

---

## Implementation Plan

See `docs/superpowers/plans/2026-05-24-claude-code-intelligence-loop-plan.md` (created by writing-plans skill).

---

## Open Questions (resolved)

| Question | Decision |
|---|---|
| Budget cap on CC calls? | None — CC calls are outside the unit budget system |
| Auto-merge PRs? | No — human reviews and merges all CC-generated PRs |
| Separate microservice? | No — both services live inside runlayer |
| CC planning default on? | `CC_PLANNING_ENABLED=false` by default — opt-in per project |
| Review default on? | `CC_REVIEW_ENABLED=true` — on by default |
