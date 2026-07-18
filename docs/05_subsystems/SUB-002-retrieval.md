# Subsystem: Documentation Retrieval

```yaml
id: SUB-002
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/04_systems/SYS-001-docs-rag-service.md
downstream:
  - docs/10_features/FEAT-002-agent-context-retrieval.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
  - docs/07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Purpose
Answer semantic documentation questions and produce token-budgeted context blocks for agents.

## Parent system
`docs/04_systems/SYS-001-docs-rag-service.md`

## Responsibilities
- Embed retrieval queries.
- Search Qdrant with filters.
- Format source-attributed results.
- Enforce token budgets for agent-context responses.
- Keep retrieval endpoints authenticated.

## Interfaces
`POST /retrieval/search`, `POST /retrieval/agent-context`, Qdrant search client, and Ollama embedding service.

## Inputs
Query text, optional repository name, optional document type, score threshold, result limit, and token budget.

## Outputs
Semantic search responses and agent-context formatted responses.

## Dependencies
Qdrant, Ollama, service identity JWT guard, and stored document chunk metadata.

## Data ownership
Retrieval owns response formatting and source attribution. Original content ownership remains with source repositories.

## Failure modes
Missing JWT, invalid query, embedding provider failure, Qdrant unavailability, or token-budget truncation.

## Validation
Validated by retrieval service tests, controller contract validation, JWT guard behavior, and relevance checks.
