# ADR-001: Use a Central Documentation RAG Service

```yaml
id: ADR-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/01_vision/VISION.md
  - docs/02_business_case/BUSINESS_CASE.md
downstream:
  - docs/04_systems/SYS-001-docs-rag-service.md
related_adrs: []
```

## Context
Agents need ecosystem documentation context without repeatedly reading large raw Git file sets. Existing docs state that each successful RAG query can save approximately 2,000 to 5,000 tokens.

## Decision
Implement docs-rag-microservice as a centralized NestJS service that indexes ecosystem documentation into Qdrant and exposes authenticated semantic search and agent-context APIs.

## Consequences
Agents can retrieve focused context, source repositories remain authoritative, ingestion freshness matters, and retrieval quality depends on embedding availability, chunking quality, and Qdrant persistence.

## Validation
Validate through ingestion coverage, retrieval relevance checks, build/tests, and operational health checks.
