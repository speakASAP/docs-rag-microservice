# Master plan — Goal-driven AI execution platform (runlayer + pilot)

**Saved:** 2026-04-11  
**Scope:** `runlayer` (control plane) → pilot `flipflop-service` (second phase).  
**Single workspace root:** sibling repos under `~/Documents/Github` (see [shared/README.md](../../../shared/README.md)).

---

## 1. Target architecture

```text
HUMAN (goals only)
  → POST /projects/:id/goals  OR  GOALS.md (human reference; DB is SoT for goals)
  → GOAL (DB: goals, max 1 active per project)
  → SPEC.md + PLAN.md (MCP under {project_slug}/)
  → ProjectCoordinator cycle → TASK TREE (DB: tasks, each goal_id + spec_section_anchor + plan_reference)
  → WorkerAgent (run execution)
  → ValidatorAgent (validate execution)
  → DONE | RETRY (same task, attempts++) | FAIL + escalation
  → Daily digest (notifications) + dashboard API
```

**Pilot order:** (1) `runlayer` dogfood → (2) `flipflop-service` after pipeline is SAFE.

---

## 2. Phases (implementation order)

| Phase | Content                                                                                | Status                                            |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0     | Goal layer: `goals` table, `goal_id` on tasks, `POST .../goals`, 1 active goal/project | Implemented in code + SQL migration pending on DB |
| 1     | Truth: validator in pipeline, no false `done`                                          | Implemented                                       |
| 2     | Retry: transient errors, `maxAttempts`, escalation                                     | Implemented                                       |
| 3     | SPEC/PLAN gate, DB state SoT, `STATE.json` export                                      | Implemented                                       |
| 4     | Pilot slug filter (`ORCHESTRATOR_PILOT_PROJECT_SLUG`)                                  | Implemented                                       |
| 5     | Daily digest + cost policy (default cheap, smart/premium approval)                     | Implemented                                       |
| 6     | DB migration `003_goals_table_and_task_goal_id.sql` on production                      | **Operator**                                      |
| 7     | Flipflop pilot: goals, SPEC/PLAN under MCP root, activate goal                         | **Backlog**                                       |

---

## 3. System invariants

1. `task.status = done` only if `_validation.passed === true` on `output_ref`.
2. Transient failure and `attempt < maxAttempts` ⇒ requeue same task (no new task row for retry).
3. `task.goal_id` required for every task (`TasksService.create`).
4. Coordinator cycle requires: active goal + SPEC.md + PLAN.md (MCP).
5. Max one **active** goal per project (`GoalsService.activate` + unique index).
6. DB `project.state_snapshot` authoritative; `STATE.json` derived export.
7. Premium/smart models only with policy approval (`PolicyService` + `quota` / `settingsRef`).
8. **Free-first model policy:** All inference routes through `ai-microservice /ai/complete`. Tier order: `free` (Ollama local) → `cheap` (OpenRouter free tier) → `smart` (Gemini Flash). `premium` blocked without explicit human approval. No agent calls external LLM APIs directly.

## 3a. Token optimization strategy

Inter-agent payloads must minimize token count — free-tier rate limits make verbose payloads expensive:

- Pass `goal_id` / `task_id` / `project_id` not full text.
- Pass `spec_section_anchor` + `plan_reference` not full document bodies.
- Store large outputs at `payload_ref` (MCP/filesystem path); pass the ref, not the content.
- Worker system prompts ≤ 300 tokens; coordinator ≤ 600 tokens.
- Always set `correlation_id = task_id` for tracing.

---

## 4. Anti-chaos rules

- Agents must not create goals; goals only via authenticated API / human.
- Agents must not create tasks outside orchestrator paths.
- Agents must not silently edit `BUSINESS.md`, `SPEC.md`, `GOALS.md`.
- Max pilot orchestration surface controlled by env (single slug default).

---

## 5. Related files (see [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md))

---

## 6. Success criteria

- Migration applied; at least one goal activated for pilot project slug.
- Coordinator runs cycles; tasks created with `goal_id`.
- Validator pass rate measurable; digest shows goals section.
- Flipflop enabled only after metrics stable on runlayer.
