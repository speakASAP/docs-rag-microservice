# Context Package: TASK-002 Restore Ollama Embedding Connectivity

```yaml
id: CP-TASK-002
status: reviewed
owner: platform-engineering
created: 2026-07-02
upstream:
  - docs/11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
downstream:
  - docs/14_prompts/PROMPT-TASK-002-restore-ollama-embedding-connectivity.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Target task

`docs/11_tasks/TASK-002-restore-ollama-embedding-connectivity.md`

## Upstream traceability

Vision, system, documentation-ingestion feature, task, execution plan,
goal-impact record, and ADR-001.

## Included documents

`SYSTEM.md`, `k8s/configmap.yaml`, `src/ingestion/embedding.service.ts`,
`docs/RAG_USAGE.md`, and `scripts/deploy.sh`.

## Excluded documents

Vault secret values, raw JWTs, production customer data, and unrelated runtime
source files.

## Constraints

Keep ingestion and retrieval JWT-protected. Do not print secrets. Do not alter
API contracts, database schema, Qdrant schema, or controller behavior.

## Agent prompt

Restore Docs/RAG embedding connectivity by aligning `OLLAMA_URL` with the live
Docker Ollama host port, then validate from the Docs/RAG pod and Cliplot
readiness scripts.

## Validation instructions

Run build, tests, strict audit, deployment gate, Docs/RAG deploy, embedding
shape check, Cliplot Docs/RAG preflight, and Cliplot readiness bundle.
