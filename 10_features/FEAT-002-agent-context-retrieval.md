# Feature: Agent Context Retrieval

```yaml
id: FEAT-002
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 09_milestones/MS-001-ips-adoption.md
  - 04_systems/SYS-001-docs-rag-service.md
downstream:
  - 11_tasks/TASK-001-implement-ips-standard.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
```

## User or system need
Agents need focused, token-budgeted documentation context for implementation work.

## Goal
Agents need focused, token-budgeted documentation context for implementation work.

## Goal impact
Supports `22_goal_impact/GOAL-IMPACT-TASK-001.md` by keeping the service traceable to token savings, retrieval relevance, and operational safety.

## Scope
Maintain semantic search and the agent-context retrieval endpoint responses with source attribution and token-budget behavior.

## Non-goals
Making RAG output authoritative over source docs or exposing retrieval publicly without JWT.

## Acceptance criteria
- Retrieval returns relevant source-attributed results for documented query categories within the requested token budget.
- Related changes include validation evidence before deployment or closure.
- Sensitive data is excluded from docs, examples, prompts, tests, logs, and reports.

## Dependencies
`SYS-001`, the relevant subsystem documents, Qdrant, PostgreSQL, Ollama, JWT service identity, and Kubernetes deployment configuration.

## Traceability
Vision, business case, and system docs in this repository.

## Validation strategy
Run focused unit tests for changed behavior plus IPS audit and operational gates for documentation or deployment work.

## Validation
Feature validation is recorded through task validation reports under `12_validation/`.
