# TASK-003 Ollama Embedding Operational Hardening

```yaml
id: TASK-003
status: reviewed
owner: platform-engineering
created: 2026-07-04
execution_plan: 21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md
upstream:
  - 01_vision/VISION.md
  - 04_systems/SYS-001-docs-rag-service.md
  - 07_decisions/ADR-001-documentation-rag-service.md
  - 11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
downstream:
  - 21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md
  - 14_prompts/PROMPT-TASK-003-ollama-embedding-operational-hardening.md
  - 12_validation/VAL-TASK-003-ollama-embedding-operational-hardening.md
goal_impact: 22_goal_impact/GOAL-IMPACT-TASK-003.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
  - 07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Objective

Add a repeatable read-only embedding backend readiness gate and a guarded repair
path for the Docker Ollama runtime used by Docs/RAG.

## Upstream Links

- `01_vision/VISION.md`
- `04_systems/SYS-001-docs-rag-service.md`
- `07_decisions/ADR-001-documentation-rag-service.md`
- `11_tasks/TASK-002-restore-ollama-embedding-connectivity.md`

## Goal Impact

Cliplot and other consumers can distinguish a stopped Ollama backend from a
Docs/RAG application regression, repair the runtime safely, and re-run preflight
without triggering documentation ingestion.

## Project invariant impact

Preserves `DRAG-INV-002` by leaving JWT-protected retrieval and ingestion
unchanged. Preserves `DRAG-INV-003` by printing only URL, status, model-count,
container-state, and restart-policy metadata.

## Sensitive-data classification

Operational metadata only. No JWT, secret values, raw production data, customer
data, embeddings, or source document content may be printed.

## Contract/schema impact

No API, DTO, database, Qdrant, or Kubernetes schema changes.

## Replay/determinism impact

The readiness gate is read-only and repeatable. The repair path is explicitly
guarded and starts only the configured Ollama container when confirmed.

## Scope

- Add a read-only script that checks configured Ollama URL, Docker container
  state, host tags reachability, and pod tags reachability.
- Add a guarded repair script that can start only the configured Ollama
  container after explicit confirmation.
- Document the operational procedure and validation evidence.

## Non-Goals

- Do not trigger ingestion endpoints.
- Do not print JWTs, secrets, raw production data, or customer data.
- Do not mutate ConfigMaps, Secrets, databases, Qdrant, or Docs/RAG API
  contracts.
- Do not deploy application runtime code for this tooling-only increment.

## Acceptance Criteria

- `npm run readiness:embedding-backend` returns pass while Ollama is healthy.
- `npm run repair:embedding-backend` is a no-op while healthy.
- The repair script requires `CONFIRM=start-ollama-container` before starting
  a stopped container.
- Cliplot `npm run readiness:bundle` remains pass after repair.

## Required Context

- `SYSTEM.md`
- `STATE.json`
- `k8s/configmap.yaml`
- `src/ingestion/embedding.service.ts`
- `12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`

## Validation Task

Record command evidence for the read-only gate, guarded no-op repair, Docs/RAG
gates, Cliplot Docs/RAG preflight, and Cliplot readiness bundle.

## Execution Plan Requirement

Use `21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md`
before editing scripts or operation documents.

## Required gates

- `npm run build`
- `npm run docs:audit`
- `npm run gate:pre-coding`
- `npm run gate:deployment -- --target TASK-003`
- `npm run readiness:embedding-backend`
- `npm run repair:embedding-backend`
