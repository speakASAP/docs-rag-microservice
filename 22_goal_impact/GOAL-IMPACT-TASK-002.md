# GOAL-IMPACT-TASK-002

```yaml
id: GOAL-IMPACT-TASK-002
artifact_type: task
artifact_id: TASK-002
artifact_path: ../11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
upstream_links:
  - ../01_vision/VISION.md
  - ../04_systems/SYS-001-docs-rag-service.md
primary_goal: Restore documentation retrieval freshness through working embeddings.
impact_level: high
status: reviewed
owner: platform-engineering
created: 2026-07-02
upstream:
  - 11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
```

## Explanation

Docs/RAG depends on an Ollama-compatible embedding backend for ingestion and
retrieval. The service was healthy, but Cliplot readiness showed embedding
fetch failures because the configured host port referenced an inactive legacy
Ollama endpoint.

## Evidence

- Docs/RAG ingestion status returned HTTP 200.
- Legacy `http://192.168.88.53:11434/api/tags` refused connection.
- Active Docker Ollama `http://192.168.88.53:11435/api/tags` returned models.
- `nomic-embed-text` returns 768-dimensional embeddings from the Docs/RAG pod.

## Validation

Validation is complete when Docs/RAG deployment passes and Cliplot
`DOCS_RAG_PREFLIGHT_ONLY=1` reports `DOCS_RAG_PREFLIGHT=pass`.
