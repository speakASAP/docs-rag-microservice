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

> **Superseded 2026-08-25 for the algorithm and credential shape** by
> [`auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md).
> The decision to protect ingestion and retrieval **stands**. The mechanism does
> not: new callers use an Auth-issued **RS256** service JWT, one principal per
> `(caller → target)` pair, minted only with
> `auth-microservice/scripts/provision-service-token.js`. HS256 and a shared
> `JWT_SECRET` are legacy — the existing path keeps working, but no new caller
> may adopt it.

Keep `/health` public for liveness only. Require HS256 service-to-service JWT authentication on ingestion and retrieval endpoints.

## Consequences
Runtime `JWT_SECRET` must come through Vault/Kubernetes secrets, agents need bearer tokens, health checks remain unauthenticated, and examples must use placeholders.

## Validation
Validate with service identity tests, endpoint behavior, deployment secret configuration, and sensitive-data scans.
