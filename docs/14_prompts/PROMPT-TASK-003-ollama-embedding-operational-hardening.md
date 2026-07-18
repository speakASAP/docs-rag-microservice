# Coding Prompt: TASK-003 Ollama Embedding Operational Hardening

```yaml
id: PROMPT-TASK-003
status: reviewed
owner: platform-engineering
created: 2026-07-04
upstream:
  - docs/13_context_packages/CP-TASK-003-ollama-embedding-operational-hardening.md
downstream:
  - docs/12_validation/VAL-TASK-003-ollama-embedding-operational-hardening.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Task summary

Harden Docs/RAG Ollama embedding backend operations after a stopped Docker
Ollama container blocked Cliplot Docs/RAG preflight.

## Role

You are an implementation agent working under IPS governance.

## Task

Implement read-only backend readiness and guarded repair scripts for the
Docs/RAG Ollama dependency.

## Context

Use the TASK-003 context package, execution plan, Docs/RAG system document,
TASK-002 validation report, and live Kubernetes/Docker evidence.

## Required context

Read `docs/21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md`,
`docs/13_context_packages/CP-TASK-003-ollama-embedding-operational-hardening.md`,
`SYSTEM.md`, `k8s/configmap.yaml`, and
`src/ingestion/embedding.service.ts`.

## Allowed changes

Operational scripts, package script aliases, operation docs, IPS traceability
docs, validation reports, project graph, and `STATE.json`.

## Forbidden changes

No ingestion trigger, no secret values, no unauthenticated retrieval or
ingestion, no API contract changes, no database schema changes, no Qdrant schema
changes, no ConfigMap or Secret mutation, and no application runtime deployment
for tooling-only edits.

## Implementation instructions

Add a read-only gate that checks configured Ollama URL, Docker container state,
host tags reachability, pod tags reachability, and expected model presence. Add
a repair script that requires `CONFIRM=start-ollama-container` before running
only `docker start ai-microservice-ollama-green`.

## Constraints

Preserve JWT auth and do not run mutating ingestion.

## Acceptance criteria

`npm run readiness:embedding-backend` passes, `npm run repair:embedding-backend`
is a no-op while healthy, repair requires confirmation when blocked, Cliplot
Docs/RAG preflight passes, and Cliplot readiness bundle passes.

## Validation commands

`npm run build`, `npm run docs:audit`, `npm run gate:pre-coding`,
`npm run gate:deployment -- --target TASK-003`,
`npm run readiness:embedding-backend`, `npm run repair:embedding-backend`,
Cliplot `DOCS_RAG_PREFLIGHT_ONLY=1 ./scripts/publish_docs_rag.sh --preflight cliplot`,
and Cliplot `npm run readiness:bundle`.

## Expected output

Scripts, runbook, IPS evidence, validation evidence, and passing Cliplot
readiness bundle.

## Validation

Record results in `docs/12_validation/VAL-TASK-003-ollama-embedding-operational-hardening.md`.
