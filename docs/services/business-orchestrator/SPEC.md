# SPEC — business-orchestrator (Project OS)

## Scope

Goal-driven **project OS** microservice (public name: Project OS): HUMAN → GOAL (queued) → PLANNING (AI proposes task breakdown, human reviews) → HUMAN APPROVAL → TASK TREE (active) → AGENT WORKERS → VALIDATION → DONE.

Coordinator cycles, worker execution, validation gate, retries, digest, pilot isolation, goal management.

## Out of scope

- Replacing ai-microservice or nginx-microservice.
- Full owner UI.
- Agents creating goals or tasks outside the orchestrator.

## Acceptance (human)

- Tasks reach `done` only after validator pass.
- Every task has a `goal_id`.
- DB `state_snapshot` is authoritative; `STATE.json` is export only.
- Max 1 active goal per project at any time (enforced: unique partial index on planning/approved/active).
- Human can edit goal title, description, priority while status is queued/planning.
- Human must approve AI-proposed task plan before any tasks are created.

## Dashboard

Implemented at `https://orchestrator.alfares.cz`. Sections:

| Nav | Content |
|-----|---------|
| Projects | Business/project cards with inline goal CRUD (UI label; API unchanged) |
| Goals | All goals across all projects, clickable/editable |
| Tasks | All tasks across all projects |
| Agents | Agent pool stat cards |
| Admin | Business/project lifecycle action panel |

Goal lifecycle states: `queued → planning → approved → active → completed / cancelled`.
