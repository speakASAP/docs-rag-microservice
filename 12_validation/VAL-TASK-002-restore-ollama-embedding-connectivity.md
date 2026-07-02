# Validation Report: TASK-002 Restore Ollama Embedding Connectivity

```yaml
id: VAL-TASK-002
status: reviewed
owner: platform-engineering
created: 2026-07-02
upstream:
  - 11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
  - 21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md
```

## Artifact validated

`TASK-002`: Restore Ollama embedding connectivity for Docs/RAG.

## Validation scope

Runtime configuration, embedding model availability, Docs/RAG rollout, and Cliplot preflight evidence.

## Summary

Docs/RAG embedding connectivity repair is complete. The active Docker
Ollama endpoint is reachable on host port `11435`, `nomic-embed-text`
returns 768-dimensional embeddings from inside the Docs/RAG pod, and
Cliplot Docs/RAG preflight now passes.

## Upstream goal

Restore authenticated documentation ingestion and retrieval freshness for
Cliplot and the Alfares service ecosystem.

## Criteria checked

- Ollama model availability.
- Embedding vector shape.
- Kubernetes configuration points at reachable Ollama host port.
- Deployment and Cliplot preflight evidence.

## Evidence

```text
preDeploy.ollamaTags=includes nomic-embed-text:latest
preDeploy.embeddingStatus=200
preDeploy.embeddingLength=768
config.OLLAMA_URL=http://192.168.88.53:11435
```

```text
commit=2d17181
deploy.image=localhost:5000/docs-rag-microservice:2d17181
deploy.rollout=success
deploy.health=pass
runtime.OLLAMA_URL=http://192.168.88.53:11435
runtime.tagsStatus=200
runtime.hasNomic=true
runtime.embeddingStatus=200
runtime.embeddingLength=768
cliplot.DOCS_RAG_PREFLIGHT=pass
cliplot.docsRagStatusHttp=200
cliplot.embeddingBackendUrl=http://192.168.88.53:11435
cliplot.embeddingHttp=200
cliplot.CLIPLOT_READINESS_BUNDLE=pass
```


## Gate evidence

`npm run docs:audit`, `npm run gate:pre-coding`, and `npm run gate:deployment -- --target TASK-002` passed before deployment.

## Invariant evidence

JWT-protected ingestion and retrieval boundaries remain unchanged.

## Sensitive-data scan evidence

No secret values were printed or added to the repository.

## Replay and determinism evidence when applicable

Configuration and validation commands are repeatable; live model pull is an external runtime state operation.

## Passed criteria

- Ollama model availability precheck passed.
- Embedding vector shape precheck passed.
- Docs/RAG deployment passed.
- Cliplot Docs/RAG preflight passed.
- Cliplot readiness bundle passed.

## Failed criteria

None in pre-deploy validation.

## Issues found

Before repair, Docs/RAG used legacy `http://192.168.88.53:11434`, which refused
connections from the pod. The active Docker Ollama service is exposed on host
port `11435`.

## Recommendation

Ready for review. Controlled ingestion may now be run when required by a consuming service because preflight passes.

## Traceability confirmation

This report traces to `TASK-002`, `EP-TASK-002`, `GOAL-IMPACT-TASK-002`,
`SYS-001`, and `ADR-001`.
