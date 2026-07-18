# Feature: Documentation Ingestion

```yaml
id: FEAT-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/09_milestones/MS-001-ips-adoption.md
  - docs/04_systems/SYS-001-docs-rag-service.md
downstream:
  - docs/11_tasks/TASK-001-implement-ips-standard.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## User or system need
Agents and platform engineers need ecosystem markdown indexed so documentation can be searched without broad raw file reads.

## Goal
Agents and platform engineers need ecosystem markdown indexed so documentation can be searched without broad raw file reads.

## Goal impact
Supports `docs/22_goal_impact/GOAL-IMPACT-TASK-001.md` by keeping the service traceable to token savings, retrieval relevance, and operational safety.

## Scope
Maintain ingestion triggers, markdown chunking, embedding generation, Qdrant upsert, and ingestion status reporting.

## Non-goals
Changing source repository documentation ownership or storing runtime secrets in indexed documentation.

## Acceptance criteria
- Ingestion can process configured repositories, persist chunk metadata, write vectors, and report status.
- Related changes include validation evidence before deployment or closure.
- Sensitive data is excluded from docs, examples, prompts, tests, logs, and reports.

## Dependencies
`SYS-001`, the relevant subsystem documents, Qdrant, PostgreSQL, Ollama, JWT service identity, and Kubernetes deployment configuration.

## Traceability
Vision, business case, and system docs in this repository.

## Validation strategy
Run focused unit tests for changed behavior plus IPS audit and operational gates for documentation or deployment work.

## Validation
Feature validation is recorded through task validation reports under `docs/12_validation/`.
