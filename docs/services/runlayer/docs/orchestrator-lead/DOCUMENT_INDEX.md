# Document index — everything needed to implement / operate the goal-driven orchestrator

Paths are relative to **repository root** unless noted as **sibling** (`../other-repo/`).

## A. Lead orchestration (this folder)

| File | Purpose |
| ---- | ------- |
| [MASTER_PLAN.md](./MASTER_PLAN.md) | Consolidated architecture, phases, invariants |
| [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md) | This index |
| [ORCHESTRATOR_AGENT_MASTER_PROMPT.md](./ORCHESTRATOR_AGENT_MASTER_PROMPT.md) | Master prompt for the lead AI orchestrator (delegation rules) |
| [PROGRESS_STATE.json](./PROGRESS_STATE.json) | Machine-readable checkpoint for next session |

## A2. Agent prompts (SpeakASAP-style — canonical)

| File | Purpose |
| ---- | ------- |
| [../agents/master-prompt.md](../agents/master-prompt.md) | Lead Orchestrator role + paired-prompt workflow |
| [../agents/ORCHESTRATOR_TASKS_INDEX.md](../agents/ORCHESTRATOR_TASKS_INDEX.md) | Task IDs, `AGENT*` / `AGENT*V` paths, sync gates |
| [../agents/AGENT*.md](../agents/) | Per-task Implementation + Validator prompts |
| [../agents/master-prompt-portfolio-refactor.md](../agents/master-prompt-portfolio-refactor.md) | Dedicated PF orchestration master prompt (completed track) |
| [../agents/PORTFOLIO_REFACTOR_PHASE_PLAN.md](../agents/PORTFOLIO_REFACTOR_PHASE_PLAN.md) | PF phase graph and completion status |
| [../agents/PORTFOLIO_CONTRACTS_FREEZE.md](../agents/PORTFOLIO_CONTRACTS_FREEZE.md) | Frozen PF contract baseline used for PF-2/PF-3 |

## B. runlayer — product & policy (repo root)

| File | Purpose |
| ---- | ------- |
| [BUSINESS.md](../../BUSINESS.md) | Business constitution (human only) |
| [SPEC.md](../../SPEC.md) | What to build (human only) |
| [PLAN.md](../../PLAN.md) | Versioned plan |
| [GOALS.md](../../GOALS.md) | Human goal narrative (DB is SoT for goals) |
| [SYSTEM.md](../../SYSTEM.md) | Ports, env names, deploy |
| [AGENTS.md](../../AGENTS.md) | Agent behaviour for this repo |
| [TASKS.md](../../TASKS.md) | Small backlog for humans/agents |
| [STATE.json](../../STATE.json) | Export snapshot (DB wins if conflict) |

## C. runlayer — technical deep dive

| File | Purpose |
| ---- | ------- |
| [docs/ARCHITECTURE.md](../ARCHITECTURE.md) | Original design (some items still roadmap) |
| [migrations/003_goals_table_and_task_goal_id.sql](../../migrations/003_goals_table_and_task_goal_id.sql) | **Run on DB** for goals + task columns |
| [migrations/002_pause_non_pilot_projects.sql](../../migrations/002_pause_non_pilot_projects.sql) | Optional SQL comment for pausing projects |

## D. Workspace-wide standards (sibling `shared/`)

| File | Purpose |
| ---- | ------- |
| [shared/docs/PROJECT_AGENT_DOCS_STANDARD.md](../../../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md) | Required files per repo, reading order, anti-chaos |
| [shared/README.md](../../../shared/README.md) | Ecosystem map, microservices list |
| [shared/docs/cursor/CURSOR_SETUP.md](../../../shared/docs/cursor/CURSOR_SETUP.md) | Hooks, MCP, skills |
| [CLAUDE.md](../../../CLAUDE.md) (workspace root) | Global workflow rules |

## E. Pilot project (phase 2): flipflop-service

When enabling pilot #2, ensure under **MCP_FILESYSTEM_ROOT** (usually parent of repos):

- `flipflop-service/SPEC.md`
- `flipflop-service/PLAN.md`
- `flipflop-service/GOALS.md` (human)
- Repo copies: `../../../flipflop-service/SPEC.md` from this folder (create if missing — same standard as PROJECT_AGENT_DOCS_STANDARD)

Also: `flipflop-service` must have `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json` per standard.  
Repo path from workspace root: `flipflop-service/` (sibling of `runlayer/`).

## F. Runtime configuration

| File | Purpose |
| ---- | ------- |
| [runlayer/.env.example](../../.env.example) | `DAILY_DIGEST_*`, service URLs, and runtime config keys |

## F2. Operations scripts

| File | Purpose |
| ---- | ------- |
| [scripts/README-scripts.md](../../scripts/README-scripts.md) | **Start here** — full ops guide: usage, workflows, known bugs, architecture diagram |
| [scripts/orch-status.sh](../../scripts/orch-status.sh) | Full system status (containers, health, goals, task summary) |
| [scripts/orch-project-health.sh](../../scripts/orch-project-health.sh) | Generic project health report (`<slug|uuid>`: goals, throughput, failure rate, verdict) |
| [scripts/orch-flipflop-health.sh](../../scripts/orch-flipflop-health.sh) | Compatibility wrapper for `orch-project-health.sh flipflop-v1` |
| [scripts/orch-runlayer-health.sh](../../scripts/orch-runlayer-health.sh) | Compatibility wrapper for `orch-project-health.sh runlayer` |
| [scripts/orch-trigger-cycle.sh](../../scripts/orch-trigger-cycle.sh) | Trigger coordinator cycle by slug or UUID |
| [scripts/orch-check-tasks.sh](../../scripts/orch-check-tasks.sh) | Task status table + count summary for a project |
| [scripts/orch-test-ai.sh](../../scripts/orch-test-ai.sh) | Smoke-test `/ai/complete` for free/cheap/smart tier |
| [scripts/_orch-common.sh](../../scripts/_orch-common.sh) | Shared library (env loading, DB query, port detection, JWT) |

**Quick commands:**
```bash
./scripts/orch-status.sh                        # health overview
./scripts/orch-project-health.sh flipflop-v1     # flipflop pilot health report
./scripts/orch-project-health.sh runlayer  # self-dogfood project health report
./scripts/orch-test-ai.sh                       # AI smoke test
./scripts/orch-trigger-cycle.sh flipflop-v1     # run cycle
./scripts/orch-check-tasks.sh flipflop-v1       # check results
```

## G. Key source modules (for implementers)

| Area | Path |
| ---- | ---- |
| Worker + validation | `src/worker/worker-agent.service.ts` |
| Tasks + invariants | `src/tasks/tasks.service.ts`, `src/tasks/task.entity.ts` |
| Goals API | `src/goals/*` |
| Coordinator | `src/coordinator/project-coordinator.service.ts` |
| Global pilot filter | `src/coordinator/global-coordinator.service.ts` |
| Digest | `src/digest/daily-digest.service.ts` |
| Policy / cost | `src/common/policy/policy.service.ts` |
