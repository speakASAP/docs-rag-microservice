# EP-TASK-003 Ollama Embedding Operational Hardening

```yaml
id: EP-TASK-003
status: reviewed
owner: platform-engineering
source_task: ../11_tasks/TASK-003-ollama-embedding-operational-hardening.md
vision: 01_vision/VISION.md
constitution: 00_constitution/CONSTITUTION.md
feature: 10_features/FEAT-003-operational-readiness.md
goal_impact: 22_goal_impact/GOAL-IMPACT-TASK-003.md
upstream:
  - 11_tasks/TASK-003-ollama-embedding-operational-hardening.md
  - 22_goal_impact/GOAL-IMPACT-TASK-003.md
```

## Metadata

Task: `TASK-003`. Date: 2026-07-04. Change type: operational tooling and
runbook hardening.

## Upstream Traceability

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding
Prompt -> Code -> Validation.

## Goal Impact

Reduces recurrence risk for Docs/RAG preflight failures by making the embedding
backend dependency observable and safely repairable without mutating ingestion
state.

## Project invariants

- `DRAG-INV-002`: JWT-protected ingestion and retrieval boundaries unchanged.
- `DRAG-INV-003`: no secret or raw production data output.
- `DRAG-INV-005`: closure requires command evidence in validation.

## Sensitive-data handling

Scripts print only status metadata: configured URL, model count, model presence,
Docker state, restart policy, and pass or blocked verdict. Secret values and
JWTs are never read or printed.

## Contract validation plan

No API or schema contract changes. Validate by `npm run build` and audit gates.

## Replay/determinism plan

Readiness check is deterministic for current runtime state. Repair is explicit,
guarded by `CONFIRM=start-ollama-container`, and starts only the named Ollama
container.

## Scope

Create operational scripts and docs for embedding backend readiness and repair.

## Non-Goals

No application deploy, no ingestion trigger, no ConfigMap or Secret mutation, no
database or Qdrant mutation, and no API/auth change.

## Files to Inspect

- `SYSTEM.md`
- `STATE.json`
- `k8s/configmap.yaml`
- `src/ingestion/embedding.service.ts`
- `12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`

## Files to Create

- `scripts/check-embedding-backend.sh`
- `scripts/repair-embedding-backend.sh`
- `16_operations/OLLAMA_EMBEDDING_BACKEND.md`
- `11_tasks/TASK-003-ollama-embedding-operational-hardening.md`
- `21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md`
- `22_goal_impact/GOAL-IMPACT-TASK-003.md`
- `13_context_packages/CP-TASK-003-ollama-embedding-operational-hardening.md`
- `14_prompts/PROMPT-TASK-003-ollama-embedding-operational-hardening.md`
- `12_validation/VAL-TASK-003-ollama-embedding-operational-hardening.md`

## Files to Modify

- `package.json`
- `STATE.json`
- `graph/project_graph.example.yaml`

## Files That Must Not Be Modified

- `00_constitution/CONSTITUTION.md`
- `01_vision/VISION.md`
- Vault secret values
- API controllers, DTOs, migrations, and Qdrant schema

## Implementation Steps

1. Add the read-only embedding backend check script.
2. Add the guarded repair script.
3. Add npm script aliases.
4. Add the operational runbook and IPS artifacts.
5. Update graph traceability.
6. Validate gates and Cliplot consumer readiness.

## Test Plan

- `npm run build`
- `npm run docs:audit`
- `npm run gate:pre-coding`
- `npm run gate:deployment -- --target TASK-003`
- `npm run readiness:embedding-backend`
- `npm run repair:embedding-backend`

## Validation Plan

- Verify Docker Ollama is running with restart policy metadata.
- Verify host tags endpoint includes `nomic-embed-text`.
- Verify Docs/RAG pod reaches the same tags endpoint.
- Verify guarded repair is no-op while healthy.
- Verify Cliplot Docs/RAG preflight and readiness bundle pass.

## Gate Commands

```bash
npm run build
npm run docs:audit
npm run gate:pre-coding
npm run gate:deployment -- --target TASK-003
npm run readiness:embedding-backend
npm run repair:embedding-backend
```

## Documentation Updates

Add `16_operations/OLLAMA_EMBEDDING_BACKEND.md` and validation evidence in
`12_validation/VAL-TASK-003-ollama-embedding-operational-hardening.md`.

## Rollback Plan

Revert the tooling/documentation commit. Runtime Ollama state is not changed by
the commit. If a manual repair was run, stopping the runtime is an operator
decision outside this task.

## Agent Handoff Prompt

Implement Docs/RAG Ollama embedding backend hardening. Add a read-only backend
gate and a guarded container-start repair path. Do not trigger ingestion, print
secrets, mutate ConfigMaps or Secrets, or change API contracts.

## Completion Checklist

- [x] Read-only backend gate added.
- [x] Guarded repair script added.
- [x] Runbook added.
- [x] Graph traceability added.
- [x] Validation report finalized.
