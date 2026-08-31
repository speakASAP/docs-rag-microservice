# Project Invariants: docs-rag-microservice

status: validated
completeness_level: validated

## Purpose

Protect bounded semantic discovery without compromising Git authority, source attribution, authentication, or sensitive-data handling.

## Applicability

These invariants apply to ingestion, retrieval, source selection, authentication, logs, and all changes to their contracts.

## Invariants

| ID | Rule | Validation method |
| --- | --- | --- |
| DRAG-INV-001 | Git repositories remain authoritative and responses preserve source paths. | Review retrieval responses and source references. |
| DRAG-INV-002 | Retrieval and ingestion require service JWT authentication; health remains public. | Review ServiceAuthGuard and health controller. |
| DRAG-INV-003 | Only catalog entries marked docsRag true are indexed; copied retired snapshot content is excluded. | Review repo-registry and ingestion exclusions. |
| DRAG-INV-004 | Secrets, tokens, raw production data, and sensitive embeddings are not logged or documented. | Review CentralLogger redaction and documentation evidence. |
| DRAG-INV-005 | Unconfident or unavailable results require direct Git fallback. | Review retrieval contract and agent instructions. |

## Exceptions

No exception permits replacing Git authority, making guarded routes public, indexing retired copied snapshots, or exposing sensitive data. An exception requires project-owner approval and a governance amendment.

## Review cadence

Review before changing source selection, retrieval confidence behavior, authentication, persistence, embeddings, or deployment-facing configuration.
