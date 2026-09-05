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

Keep health public for liveness only. Ingestion and retrieval are machine-accessible
routes governed solely by auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md.
Each caller-to-docs-rag-microservice pair has one Auth-registered RS256 bearer JWT,
minted or re-minted only by auth-microservice/scripts/provision-service-token.js.
The receiver validates through Auth or an approved local RS256 verifier, creates a
separate service actor, declares and enforces target-scoped roles per route, and
denies and error-logs undecorated routes. Credentials flow only through Vault ->
ExternalSecret -> Kubernetes Secret -> secretKeyRef.

## Consequences
Runtime `JWT_SECRET` must come through Vault/Kubernetes secrets, agents need bearer tokens, health checks remain unauthenticated, and examples must use placeholders.

## Validation
Validate with service identity tests, endpoint behavior, deployment secret configuration, and sensitive-data scans.
