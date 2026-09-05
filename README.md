# docs-rag-microservice

## Status

Operational production service with public health reporting.

## Documentation authority

Git repositories are authoritative. BUSINESS.md, SYSTEM.md, and the artifacts named by ips-adoption.json are repository contracts; retrieval is advisory and critical claims require Git verification.

## Capabilities

Catalog-scoped Markdown/MDX ingestion, Ollama embeddings, Qdrant semantic retrieval, token-bounded agent context, authenticated operations, and health reporting.

## Interfaces

Health, retrieval search, agent context, ingestion trigger, ingestion trigger-all, and ingestion status are HTTP interfaces. All except health use machine authentication governed solely by the [Service Identity Consumer Standard](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md).

## Development

Run npm test, npm run build, and npm run docs:audit.

## Configuration

.env.example names configuration. PostgreSQL docs_rag, Qdrant ecosystem-docs, the shared repository catalog, and Docker-only Ollama on port 11435 are core dependencies.

## Deployment

The service runs in statex-apps using deploy.config.sh and the shared runner. Documentation work does not operate deployment, ingestion, or Ollama infrastructure.

## Health and observability

Health is public and backs Kubernetes startup, liveness, and readiness probes. CentralLogger sends sanitized logs to logging-microservice.
