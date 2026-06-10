# Project OS vision (formerly RunLayer)

## 1) Goal

Build **Project OS** — a goal-driven operating system for running multiple **digital projects** with **agent workers** and **human approvals** — so one founder can scale many codebases and products without manual coordination, while keeping control over plans and escalations.

The platform must:

- keep operating costs extremely low (free or fixed-cost AI options first);
- coordinate execution across many projects in parallel;
- enforce structured planning and validation before implementation;
- provide a visual control center for strategy, operations, and performance.

## 2) Strategic Context

Current situation:

- there are many microservices/projects (about 40);
- no project is generating stable revenue yet;
- everything is on development stage;
- manual coordination does not scale.

Target situation:

- each project can continue evolving with AI-driven execution;
- one orchestrator coordinates all projects consistently;
- the founder manages priorities, approvals, and exceptions.

## 3) Core Principles

1. **Spec-driven development**
   - Documentation and planning come first.
   - Tests created before the development.
   - Coding is the final step.

2. **Single source of truth**
   - Runtime state belongs in the orchestrator database.
   - Git docs are instructions, not task state storage.
   - No hardcoded values.
   - Use .env for variables.

3. **Human-in-the-loop only when needed**
   - Human sets goals, constraints, and priorities.
   - AI executes and reports.

4. **Cost-first architecture**
   - Prefer free/open models (OpenRouter free tier, Ollama, etc.).
   - Premium usage requires explicit human approval.

5. **Reuse existing ecosystem**
   - Prefer existing internal services before adding new tools.

6. **Token-efficient communication**
   - Pass IDs/references instead of long context blocks.
   - Use existing scripts to gather data.

## 4) Platform Scope

The `runlayer` microservice is the central layer that manages:

- business portfolio management;
- goals and project planning;
- AI worker assignment and monitoring;
- execution tracking and validation;
- operational and financial dashboards.

It should integrate with existing microservices and become a shared control layer for all projects.

## 5) Standard Project Documentation Contract

Every project should include a minimal standardized docs set to support agent execution with low context overhead:

- `SPEC.md` - business and product specification;
- `PLAN.md` - implementation plan and milestones;
- `GOALS.md` - current and upcoming goals (input layer);
- `TASKS.md` - generated/derived tasks (human-readable mirror);
- `AGENTS.md` - instructions and roles for agents in this project.

Rule:

- founder owns and approves critical business intent;
- AI can propose updates and execute against approved documentation.

## 6) Execution Pipeline

Primary flow:

`IDEA -> SPEC -> PLAN -> TASK TREE -> EXECUTION -> VALIDATION -> REPORT`

Continuous improvement flow:

`AUDIT -> GAP ANALYSIS -> REFACTOR PLAN -> EXECUTION`

Goal sourcing flow:

`HUMAN -> GOAL -> ORCHESTRATOR -> TASKS -> AGENTS`

## 7) Task Creation Rules

Tasks may only be created from goals.

Accepted goal inputs:

- API: `POST /projects/:id/goals`
- or structured `GOALS.md` entry

Example goal input:

- Goal: Launch MVP checkout
- Constraints:
  - no premium models
  - use existing services
- Priority: high

Orchestrator responsibility:

`GOAL -> PLAN (if missing) -> TASK TREE`

Task hierarchy:

- goal
- epic
- task
- subtask
- validation

Task dependency model (mandatory in planning and execution):

- `blocks` (this task blocks another task);
- `blocked_by` (this task cannot start yet);
- `predecessor` (must finish before current task);
- `successor` / `next` (task that should start after completion);
- `parallel_with` (tasks that can run concurrently).

## 8) Spec-Driven Linking Requirements

Every generated task must include:

- `goal_id`
- `spec_section_anchor`
- `plan_reference`

This guarantees traceability:

`Goal -> Spec section -> Plan item -> Executed task -> Validation result`

## 9) Data and State Consistency

Mandatory state rules:

- goal/task state is stored in orchestrator DB;
- `STATE.json` is not the runtime source of truth;
- DB must be authoritative for status, retries, and progress.

Core task fields:

- `task_id`
- `project_id`
- `goal_id`
- `type` (`analysis | coding | validation | research`)
- `status` (`created | assigned | in_progress | validation | done | failed`)
- `attempts`
- `max_attempts`
- `payload_ref`
- `validation_passed`
- `dependencies` (`blocked_by`, `blocks`, `predecessor`, `successor`)

## 10) Invariants

1. `task.status = done` **if** `validation_passed = true`
2. If `attempts < max_attempts`, retry is required before hard failure
3. `task.goal_id` must never be null
4. `SPEC -> PLAN -> TASK` chain is mandatory
5. DB is the only runtime source of truth
6. One project can have only one active goal at a time

## 11) Anti-Chaos Rules

Agents are forbidden to:

- create goals autonomously;
- create tasks outside orchestrator;
- modify `SPEC.md` directly.

System is forbidden to:

- mark tasks done without validation;
- use premium models without explicit approval.

## 12) Operating Model

Roles:

- **Founder (human):** sets goals, constraints, priorities, approvals.
- **Global orchestrator:** coordinates portfolio execution.
- **Project coordinator agent:** decomposes project goals.
- **Worker agents:** execute atomic tasks.
- **Validator agents:** verify outputs and gate completion.

High-level lifecycle:

`Human -> Goal -> Orchestrator -> Plan/Task Tree -> Workers -> Validator -> Done/Retry/Fail -> Daily Digest`

## 13) API UX for Goal Input

Endpoint:

- `POST /projects/:id/goal`

Body example:

```json
{
  "goal": "Launch MVP checkout",
  "priority": "high",
  "constraints": {
    "no_premium_models": true,
    "reuse_existing_services": true
  }
}
```

Intent:

- human provides business intent;
- orchestrator handles decomposition and execution orchestration.

## 14) Dashboard Requirements (Frontend)

The platform needs a visual console for full portfolio control.

Portfolio view:

- all businesses/projects;
- current active goal per business;
- execution health and blocked states;
- live running tasks;
- aggregate development metrics;
- later: revenue and profitability metrics.

Business view:

- list of goals (active/queued/done);
- progress by goal;
- currently running tasks.

Goal view:

- full task graph for the selected goal;
- task dependencies and statuses;
- validation state and retry history.
- explicit dependency labels: blocker, blocked, predecessor, successor, next.

Task view:

- task progress timeline;
- execution logs;
- validator logs;
- upstream/downstream dependencies;
- relation to goal/spec/plan.

Graph requirement:

- visual relationship mapping similar to issue graph tools;
- click a node to inspect linked entities (business, goal, task, dependency, logs).
- include cross-project and infrastructure-level dependency map (services, shared components, and inter-business links).
- support dependency path tracing from any task to upstream blockers and downstream next tasks.

CRUD requirement:

- create/read/update/delete for businesses, goals, and tasks (with permission and safety rules).

## 15) AI Workforce Management

The dashboard must support:

- assign/unassign (hire/fire) digital workers;
- monitor worker utilization and performance;
- inspect worker task history;
- choose or upgrade model profiles;
- improve workers performance and quality;
- increase success rate;
- train/update workers using approved RAG knowledge or project history.

## 16) Cost Strategy

Phase 1 objective:

- run on free or near-zero-cost stack;
- maximize automation under strict budget constraints.

Phase 2 objective (after first revenue):

- selectively introduce paid models where ROI is proven;
- keep premium usage gated by approval rules.

## 17) Rollout Strategy

1. Build the orchestrator core and docs standard.
2. Pilot on 1-2 projects only.
3. Stabilize pipeline reliability and validation quality.
4. Scale gradually to larger portfolio (up to 50 projects).

Reason:

- parallel rollout to all projects at once will create operational chaos and low-quality execution.

## 18) Daily Reporting Requirements

A daily digest per project should include:

- active goal;
- completion percentage;
- blocked status and blockers;
- tasks completed / in progress / failed;
- validation pass rate;
- notable risks and required human approvals;
- daily digest sent to founder's Telegram and email at 8AM and at 8PM.

## 19) Final Product Definition

`runlayer` should become a **fully visual operating system for digital businesses**, where one founder can:

- define business goals;
- delegate execution to AI workers;
- monitor progress and quality in real time;
- control costs and approvals;
- scale operations without adding human headcount.
