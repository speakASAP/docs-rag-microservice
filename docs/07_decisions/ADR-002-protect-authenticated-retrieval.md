# ADR-002: Protect Retrieval and Ingestion with Service JWT

```yaml
id: ADR-002
status: accepted
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
  - docs/06_architecture/ARCHITECTURE_OVERVIEW.md
downstream:
  - docs/05_subsystems/SUB-002-retrieval.md
  - docs/05_subsystems/SUB-003-service-identity-and-operations.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Context
The service exposes documentation search and ingestion capabilities for internal agents and services. Ingestion can alter indexed knowledge, and retrieval may expose internal operational context.

## Decision

For machine service identity, follow the sole canonical [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md). It is not reproduced here.

## Consequences
Apply all machine-identity provisioning, delivery, enforcement, validation, and rotation requirements from that standard. Health checks remain unauthenticated and examples use placeholders.

## Validation
Validate with service identity tests, endpoint behavior, deployment secret configuration, and sensitive-data scans.
