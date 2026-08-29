# Subsystem: Documentation Ingestion

```yaml
id: SUB-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-08-29
completeness_level: complete
upstream:
  - docs/04_systems/SYS-001-docs-rag-service.md
downstream:
  - docs/10_features/FEAT-001-documentation-ingestion.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Purpose
Sync repository documentation, chunk markdown content, generate embeddings, and persist searchable records.

## Parent system
`docs/04_systems/SYS-001-docs-rag-service.md`

## Responsibilities
- Accept single-repository and all-repository ingestion triggers.
- Resolve repository configuration and local documentation paths.
- Chunk markdown into retrievable segments.
- Generate embeddings using Ollama.
- Persist chunk metadata and ingestion job state.

## Interfaces
`POST /ingestion/trigger`, `POST /ingestion/trigger-all`,
`GET /ingestion/status`, the shared ecosystem repository catalog, Qdrant, and
PostgreSQL.

## Inputs
Cataloged repository names and checkout paths, markdown files, source-specific
exclusions, force flags, embedding configuration, and JWT-authenticated
ingestion requests.

## Outputs
Ingestion jobs, document chunks, embeddings, Qdrant points, and ingestion status responses.

## Dependencies
PostgreSQL, Qdrant, Ollama, Git/local filesystem access, NestJS configuration, and service identity guard.

## Data ownership
Source repositories own original documentation. This subsystem owns indexed copies, chunk metadata, and ingestion job records.

## Failure modes
Repository path unavailable, markdown parsing failure, embedding failure, Qdrant write failure, PostgreSQL failure, or invalid JWT.

## Validation
Validated by ingestion service tests, markdown chunker tests, git sync tests, entity tests, and ingestion status checks.
