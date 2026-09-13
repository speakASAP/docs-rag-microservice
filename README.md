# docs-rag-microservice

## Status

Operational production service with public health reporting. It is the shared knowledge and RAG layer for Alfares services and AI agents.

## Documentation authority

Git repositories are authoritative. BUSINESS.md, SYSTEM.md, and the artifacts named by `ips-adoption.json` are repository contracts; retrieval is an indexed representation, not a replacement for the source. Critical claims require source verification.

## Capabilities

Catalog-scoped Markdown/MDX ingestion, Ollama embeddings, Qdrant semantic retrieval, token-bounded agent context, MCP access for agents, authenticated operations, source provenance, ingestion status, and health reporting.

The service can also be extended to ingest explicitly authorized customer-owned documents and expose them as governed RAG knowledge to the AI microservice, agents, or other AI applications.

## Interfaces

Health, retrieval search, agent context, ingestion trigger, ingestion trigger-all, and ingestion status are HTTP interfaces. The service is also available to agents through the shared MCP server. All non-health operations use machine authentication governed solely by the [Service Identity Consumer Standard](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md).

## Development

Run npm test, npm run build, and npm run docs:audit.

## Configuration

`.env.example` names configuration. PostgreSQL `docs_rag`, Qdrant collection `ecosystem-docs`, the shared repository catalog, and Docker-only Ollama on port 11435 are core dependencies. Provider, source, tenant, and environment-specific values must follow the approved secret and configuration path.

## Deployment

The service runs in statex-apps using deploy.config.sh and the shared runner. Documentation work does not operate deployment, ingestion, or Ollama infrastructure.

## Health and observability

Health is public and backs Kubernetes startup, liveness, and readiness probes. CentralLogger sends sanitized logs to logging-microservice. Ingestion status, source version, freshness, retrieval provenance, and access failures should be observable without exposing document contents or sensitive embeddings.

## Positioning and use

This service is primarily an internal Alfares knowledge layer. It can be reused in customer projects as a controlled document-to-RAG implementation, especially where customers need private deployment, source-linked answers, MCP access, tenant boundaries, or integration with an existing AI gateway. It is not itself a chatbot or workflow orchestrator.
