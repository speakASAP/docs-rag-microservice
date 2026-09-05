# Integration Contract

## Purpose

Record code-verified ecosystem capability decisions for this production documentation-retrieval service.

## Capability decisions

| Capability | Decision | Evidence |
| --- | --- | --- |
| Auth | required | Machine routes follow auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md: Auth-issued per-pair RS256 bearer JWTs, target-scoped roles, a separate service actor, and fail-closed role enforcement. |
| PostgreSQL | required | TypeORM owns docs_rag chunks and ingestion jobs. |
| Redis | not-applicable | No Redis dependency, client, or configuration is used. |
| Logging | required | CentralLogger posts sanitized payloads to logging configuration. |
| Notifications | not-applicable | No notification client is used. |
| AI | not-applicable | AI_SERVICE_URL is unused; Ollama is a separate Docker runtime dependency. |
| Payments | not-applicable | No payment client or configuration is used. |
| Catalog | not-applicable | No catalog service client is used; the repository catalog is a mounted file. |
| Orders | not-applicable | No orders service client is used. |
| Warehouse | not-applicable | No warehouse service client is used. |
| Invoices | not-applicable | No invoices service client is used. |
| Object storage | not-applicable | No object-storage client is used. |
| Event bus | not-applicable | No event-bus dependency or client is used. |
| Docs-rag | required | Runtime-service validator requires this review; this service does not consume its own retrieval API. |
| Monitoring | required | Public health controller and Kubernetes probes provide runtime observation. |
| Backups | not-applicable | No backups service integration client is implemented. |

## Data ownership

docs-rag-microservice owns PostgreSQL chunk and ingestion-job records and Qdrant vector payloads. The owning Git repositories retain documentation authority.

## Authentication and authorization

Machine-accessible ingestion and retrieval routes follow the canonical service-identity standard. Auth is the only signer; receivers validate through Auth or an approved local RS256 verifier, create a separate service actor, explicitly enforce target-scoped roles, and deny and error-log undecorated routes. Pair credentials are delivered only through Vault -> ExternalSecret -> Kubernetes Secret -> secretKeyRef. Public health is explicitly public.

## Synchronous dependencies

PostgreSQL stores docs_rag data, Qdrant stores ecosystem-docs vectors, and Docker-only Ollama at port 11435 creates nomic-embed-text embeddings. Central logging receives best-effort sanitized log payloads. The shared repository catalog supplies source declarations.

## Asynchronous dependencies

No event bus is implemented. Scheduled ingestion runs every six hours only when enabled, processes sources sequentially, skips unchanged sources unless forced, and continues after individual failures as degraded.

## Degraded operation

Ollama, PostgreSQL, or Qdrant failure prevents affected embedding, persistence, or retrieval work. A failed source does not stop other ingestion sources but is degraded. Logging delivery failure does not block service execution. Low-confidence and unavailable retrieval require direct Git fallback.

## Validation

Review source evidence in app.module, embedding.service, repo-registry, qdrant.service, central-logger.service, service-auth.guard, health.controller, and k8s manifests. Run the IPS adoption validator for structural completeness.
