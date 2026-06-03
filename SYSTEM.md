# docs-rag-microservice — SYSTEM.md

## Stack
- Runtime: Node.js 20 + NestJS 10
- Language: TypeScript
- Port: 3397
- Domain: docs-rag.alfares.cz

## Key services
- PostgreSQL: docs_rag database — chunk metadata, ingestion jobs
- Qdrant: vector DB at qdrant.statex-apps.svc.cluster.local:6333, collection: ecosystem-docs
- Ollama: nomic-embed-text (768-dim) at host:11434 for embeddings

## API Endpoints
- GET /health — public, liveness check
- POST /ingestion/trigger — trigger single repo ingestion (JWT required)
- POST /ingestion/trigger-all — trigger all 35 ecosystem repos (JWT required)
- GET /ingestion/status — list recent ingestion jobs (JWT required)
- POST /retrieval/search — semantic + filtered search (JWT required)
- POST /retrieval/agent-context — token-limited context for AI agents (JWT required)

## Deployment
K8s namespace: statex-apps
Secrets: Vault path secret/prod/docs-rag-microservice → ESO → K8s Secret docs-rag-microservice-secret

## Auth
Service-to-service JWT (HS256). JWT_SECRET from Vault. @Public() for /health only.
