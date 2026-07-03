# Validation Report: TASK-003 Ollama Embedding Operational Hardening

```yaml
id: VAL-TASK-003
status: reviewed
owner: platform-engineering
created: 2026-07-04
upstream:
  - 11_tasks/TASK-003-ollama-embedding-operational-hardening.md
  - 21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md
```

## Artifact validated

Operational scripts and runbook for the Docs/RAG Ollama embedding backend.

## Validation scope

Read-only backend gate, guarded repair no-op and confirmation behavior, Cliplot
Docs/RAG preflight, and Cliplot readiness bundle.

## Summary

TASK-003 operational hardening is complete. Docs/RAG now has a read-only
embedding backend gate and a guarded repair path for the Docker Ollama runtime.
The backend is healthy, the repair path is a no-op while healthy, Cliplot
Docs/RAG preflight passes, and Cliplot readiness bundle passes.

## Upstream goal

Keep Docs/RAG ingestion and retrieval operational for Cliplot and other Alfares
services without weakening service authentication or mutating ingestion state.

## Criteria checked

- Docker Ollama container state and restart policy are visible.
- Host tags endpoint is reachable and includes `nomic-embed-text`.
- Docs/RAG pod reaches the tags endpoint.
- Guarded repair is no-op while backend is healthy.
- Cliplot preflight and readiness bundle pass after repair.

## Evidence

```text
docs-rag.npm_build=pass
docs-rag.docs_audit=pass
docs-rag.pre_coding_gate=pass
docs-rag.deployment_gate_TASK_003=pass
embedding.ollamaContainer=ai-microservice-ollama-green
embedding.ollamaContainerState=running
embedding.ollamaRestartPolicy=unless-stopped
embedding.embeddingBackendUrl=http://192.168.88.53:11435
embedding.hostTagsCheck.ok=true
embedding.hostTagsCheck.httpStatus=200
embedding.hostTagsCheck.modelCount=2
embedding.hostTagsCheck.hasExpected=true
embedding.podTagsCheck.ok=true
embedding.podTagsCheck.httpStatus=200
embedding.podTagsCheck.modelCount=2
embedding.podTagsCheck.hasExpected=true
embedding.EMBEDDING_BACKEND_CHECK=pass
repair.EMBEDDING_BACKEND_REPAIR=noop_already_healthy
cliplot.docsRagStatusHttp=200
cliplot.embeddingBackendConfigured=true
cliplot.embeddingBackendUrl=http://192.168.88.53:11435
cliplot.embeddingHttp=200
cliplot.DOCS_RAG_PREFLIGHT=pass
cliplot.CLIPLOT_READINESS_BUNDLE=pass
```

## Gate evidence

```bash
npm run build
npm run docs:audit
npm run gate:pre-coding
npm run gate:deployment -- --target TASK-003
npm run readiness:embedding-backend
npm run repair:embedding-backend
```

All commands passed. Cliplot consumer validation also passed:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && DOCS_RAG_PREFLIGHT_ONLY=1 ./scripts/publish_docs_rag.sh --preflight cliplot'
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:bundle'
```

## Invariant evidence

JWT-protected ingestion and retrieval boundaries remain unchanged.

## Sensitive-data scan evidence

Scripts print operational metadata only. No secrets, JWTs, raw production data,
customer data, embeddings, or source document content are printed.

## Replay and determinism evidence when applicable

Readiness gate is repeatable against current runtime state. Repair requires
explicit confirmation and starts only the named Ollama container.

## Passed criteria

- Docker Ollama container state and restart policy are visible.
- Host tags endpoint includes `nomic-embed-text`.
- Docs/RAG pod reaches the tags endpoint.
- Guarded repair is no-op while backend is healthy.
- Cliplot Docs/RAG preflight passes.
- Cliplot readiness bundle passes.

## Failed criteria

None.

## Issues found

The prior incident was caused by a stopped `ai-microservice-ollama-green`
container while Docs/RAG and Cliplot were otherwise healthy.

## Deviations

None planned.

## Recommendation

Ready for review. Keep the embedding backend gate in routine readiness checks and use the guarded repair before any controlled ingestion run if Ollama is stopped.

## Traceability confirmation

This report traces to `TASK-003`, `EP-TASK-003`, `GOAL-IMPACT-TASK-003`,
`SYS-001`, `FEAT-003`, and `ADR-001`.
