# Context Package: TASK-003 Ollama Embedding Operational Hardening

```yaml
id: CP-TASK-003
status: reviewed
owner: platform-engineering
created: 2026-07-04
upstream:
  - docs/11_tasks/TASK-003-ollama-embedding-operational-hardening.md
downstream:
  - docs/14_prompts/PROMPT-TASK-003-ollama-embedding-operational-hardening.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Target task

`TASK-003`: `docs/11_tasks/TASK-003-ollama-embedding-operational-hardening.md`

## Upstream traceability

Vision, system, operational-readiness feature, TASK-002 connectivity repair,
TASK-003, execution plan, goal-impact record, and ADR-001.

## Included documents

`SYSTEM.md`, `STATE.json`, `k8s/configmap.yaml`,
`src/ingestion/embedding.service.ts`,
`docs/12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`, and
`docs/21_execution_plans/EP-TASK-003-ollama-embedding-operational-hardening.md`.

## Excluded documents

Vault secret values, raw JWTs, production customer data, raw embeddings, source
document content, and unrelated runtime source files.

## Constraints

Keep ingestion and retrieval JWT-protected. Do not print secrets. Do not alter
API contracts, database schema, Qdrant schema, controller behavior, ConfigMaps,
or Secrets.

## Agent prompt

Add a read-only embedding backend readiness gate and a guarded Ollama
container-start repair path. Validate without triggering ingestion.

## Validation instructions

Run build, strict audit, pre-coding gate, deployment gate, embedding backend
readiness, guarded repair no-op, Cliplot Docs/RAG preflight, and Cliplot
readiness bundle.
