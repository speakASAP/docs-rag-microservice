# Project Agent Documentation Standard

Required for every **application** and **microservice** repo in the Statex workspace.

**Exception:** `logs/` sibling is not a service repo — no agent files. See [ops/logs-workspace-directory.md](ops/logs-workspace-directory.md).

## Required files

| File | Owner | Purpose |
|------|-------|---------|
| `CLAUDE.md` | Human + agents | Workspace/ecosystem instructions |
| `BUSINESS.md` | **Human only** | Goals, constraints, SLA. Agents must not edit. |
| `SPEC.md` | **Human only** | Requirements + acceptance criteria for orchestrator cycles |
| `PLAN.md` | Human approves | Versioned execution plan from SPEC |
| `SYSTEM.md` | Human primary | Ports, stack, deploy, env names, integrations |
| `AGENTS.md` | Human + coordinator | Agent boundaries, commands, logging |
| `GOALS.md` | **Human only** | Active goals for business-orchestrator (DB `goals` table is authoritative) |
| `TASKS.md` | Agents + human | Backlog ≤ 30 items; every task needs `goal_id` |
| `STATE.json` | Orchestrator | Stage, health, cycle metadata (DB `state_snapshot` is authoritative) |

## Agent reading order

`BUSINESS.md` → `SPEC.md` → `PLAN.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

## Anti-chaos rules

| Rule | Enforcement |
|------|-------------|
| Agents cannot create goals | `Goal.createdBy = human` only |
| Every task needs `goal_id` | `TasksService.create` throws if missing |
| No `done` without validation | `TasksService.markDone` requires `_validation.passed = true` |
| Max 2 active orchestrated projects | `GlobalCoordinator` filters by pilot slug |

To suggest business changes: use `BUSINESS.suggestions.md` or tasks — never edit `BUSINESS.md` directly.

→ Service list: [ECOSYSTEM_MAP.md](../ECOSYSTEM_MAP.md) | Full index: [README.md](../README.md)
