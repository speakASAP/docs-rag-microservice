# Core Entities

```yaml
id: CORE-ENTITIES-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 03_domain_model/GLOSSARY.md
downstream:
  - 04_systems/SYS-001-docs-rag-service.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
```

## Repository
A named documentation source with a URL or local path used by ingestion.

## Document Chunk
A markdown content segment with repository name, path, content, token estimate, hash, and vector metadata.

## Ingestion Job
A persisted record describing ingestion status, timing, repository target, and errors.

## Retrieval Query
A user or agent question with optional repository, document type, limit, token budget, and score filters.

## Agent Context Response
A formatted context block containing selected chunks, source metadata, and token-aware truncation.

## Service Identity
The authenticated caller identity represented by a valid service JWT.

## Validation
Entity behavior is validated by TypeORM entity tests, chunker tests, ingestion tests, retrieval tests, and API contract validation.
