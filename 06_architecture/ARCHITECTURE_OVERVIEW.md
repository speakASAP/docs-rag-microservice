# Architecture Overview

```yaml
id: ARCH-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 04_systems/SYS-001-docs-rag-service.md
downstream:
  - 07_decisions/ADR-001-documentation-rag-service.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
  - 07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Purpose
Describe the runtime architecture for centralized documentation ingestion and retrieval.

## Runtime Components
NestJS application, ingestion module, retrieval module, service identity module, PostgreSQL, Qdrant, and Ollama embedding service.

## Request Flow
A caller authenticates except for `/health`; ingestion syncs and embeds markdown; retrieval embeds queries and searches Qdrant; agent-context formats selected chunks within a token budget.

## Deployment Architecture
The service runs in Kubernetes namespace `statex-apps`. Runtime secrets flow from Vault path `secret/prod/docs-rag-microservice` through External Secrets Operator into Kubernetes secret `docs-rag-microservice-secret`.

## Data Boundaries
Repository markdown remains source-of-truth in owning repositories. Indexed chunks are derived retrieval artifacts. Secrets are runtime-only.

## Validation
Architecture is validated by build, unit tests, Kubernetes manifests, deployment health checks, and ADR review.
