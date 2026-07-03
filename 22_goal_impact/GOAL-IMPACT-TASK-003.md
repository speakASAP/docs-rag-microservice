# GOAL Impact: TASK-003 Ollama Embedding Operational Hardening

```yaml
id: GOAL-IMPACT-TASK-003
artifact_type: task
artifact_id: TASK-003
artifact_path: ../11_tasks/TASK-003-ollama-embedding-operational-hardening.md
primary_goal: operational-readiness
impact_level: medium
status: reviewed
upstream_links:
  - ../01_vision/VISION.md
  - ../04_systems/SYS-001-docs-rag-service.md
  - ../10_features/FEAT-003-operational-readiness.md
```

## Explanation

TASK-003 makes the Docs/RAG embedding backend dependency observable and
repairable without weakening service auth or triggering ingestion.

## Evidence

The check script reports configured Ollama URL, Docker container state, restart
policy, host tags reachability, pod tags reachability, and expected model
presence.

## Validation

Validation requires Docs/RAG build/gates, backend readiness pass, guarded repair
no-op while healthy, Cliplot Docs/RAG preflight pass, and Cliplot readiness
bundle pass.
