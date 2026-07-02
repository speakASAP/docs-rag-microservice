# TASK-002 Restore Ollama Embedding Connectivity

```yaml
id: TASK-002
status: validating
owner: platform-engineering
created: 2026-07-02
upstream:
  - 01_vision/VISION.md
  - 04_systems/SYS-001-docs-rag-service.md
  - 07_decisions/ADR-001-documentation-rag-service.md
downstream:
  - 21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md
goal_impact: 22_goal_impact/GOAL-IMPACT-TASK-002.md
execution_plan: 21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
```

## Objective

Restore production Docs/RAG embedding backend connectivity so Cliplot and other
services can run non-mutating Docs/RAG preflight and controlled documentation
ingestion against the live RAG service.

## Upstream Links

- `01_vision/VISION.md`
- `04_systems/SYS-001-docs-rag-service.md`
- `07_decisions/ADR-001-documentation-rag-service.md`
- `10_features/FEAT-001-documentation-ingestion.md`

## Goal Impact

This restores the operational dependency required for documentation ingestion
and retrieval freshness. It removes a platform blocker without changing
Docs/RAG API contracts, auth requirements, schemas, or stored secret handling.

## Scope

- Correct the Kubernetes `OLLAMA_URL` value from the inactive legacy port to the
  active Docker Ollama host port.
- Verify the configured embedding model returns a 768-dimensional vector from
  inside the Docs/RAG pod.
- Re-run deployment and Cliplot Docs/RAG preflight evidence.

## Non-Goals

- Do not expose unauthenticated ingestion or retrieval endpoints.
- Do not alter JWT secrets, database schema, Qdrant schema, or API contracts.
- Do not trigger mutating ingestion until preflight passes.
- Do not print secret values.

## Acceptance Criteria

- Docs/RAG pod reaches `OLLAMA_URL` from Kubernetes.
- `nomic-embed-text` is present in Ollama.
- the Ollama embeddings endpoint returns a 768-dimensional vector.
- Deployment readiness gates pass.
- Cliplot `DOCS_RAG_PREFLIGHT_ONLY=1 ./scripts/publish_docs_rag.sh cliplot-service` returns pass.

## Required Context

- `k8s/configmap.yaml`
- `SYSTEM.md`
- `STATE.json`
- `src/ingestion/embedding.service.ts`
- `12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`

## Validation Task

Record command evidence for the model pull, embedding vector shape, Kubernetes
rollout, Docs/RAG preflight, and Cliplot readiness bundle.

## Execution Plan Requirement

Use `21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md`
before editing runtime configuration.
