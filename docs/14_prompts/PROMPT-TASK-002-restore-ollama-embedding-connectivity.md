# Coding Prompt: TASK-002 Restore Ollama Embedding Connectivity

```yaml
id: PROMPT-TASK-002
status: reviewed
owner: platform-engineering
created: 2026-07-02
upstream:
  - docs/13_context_packages/CP-TASK-002-restore-ollama-embedding-connectivity.md
downstream:
  - docs/12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Task summary

Restore Docs/RAG embedding backend connectivity after runtime drift from the
legacy Ollama host port.

## Role

You are an implementation agent working under IPS governance.

## Task

Update the Docs/RAG runtime configuration to use the active Docker Ollama host
port and record validation evidence.

## Context

Use the TASK-002 context package, execution plan, Docs/RAG system document, and
the live Kubernetes evidence.

## Required context

Read `docs/21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md`,
`k8s/configmap.yaml`, `SYSTEM.md`, and `src/ingestion/embedding.service.ts`.

## Allowed changes

Docs/RAG configuration, operational state docs, IPS traceability docs, and
validation reports.

## Forbidden changes

No secret values, no unauthenticated ingestion or retrieval, no API contract
changes, no database schema changes, and no Qdrant schema changes.

## Implementation instructions

Point `OLLAMA_URL` at the reachable Docker Ollama host port, verify
`nomic-embed-text`, deploy Docs/RAG, and validate Cliplot Docs/RAG preflight.

## Constraints

Preserve JWT auth and do not run mutating ingestion until preflight passes.

## Acceptance criteria

Docs/RAG pod can reach Ollama, embedding shape is 768 dimensions, deployment
passes, Cliplot Docs/RAG preflight passes, and Cliplot readiness bundle passes.

## Validation commands

`npm run build`, `npm test`, `npm run docs:audit`,
`npm run gate:deployment -- --target TASK-002`, `./scripts/deploy.sh`, and
Cliplot `npm run readiness:bundle`.

## Expected output

Config update, IPS evidence, deployment evidence, and passing Cliplot readiness
bundle.

## Validation

Record results in `docs/12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`.
