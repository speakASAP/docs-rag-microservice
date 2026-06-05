# docs-rag-microservice — CLAUDE.md

Ecosystem RAG service. Ingests docs from local repo paths, embeds via Ollama (`nomic-embed-text`), stores in Qdrant, serves vector search and agent-context APIs.

Read SYSTEM.md for ports, endpoints, and deployment details.

## Source layout
- `src/ingestion/` — git-sync, markdown-chunker, embedding, ingestion service+controller+module
- `src/retrieval/` — retrieval service+controller+module
- `src/qdrant/` — QdrantService wrapper
- `src/database/entities/` — DocumentChunk, IngestionJob TypeORM entities
- `src/contracts/` — Zod contracts (parse-or-throw, ZodValidationPipe, ContractViolationError)
- `src/service-identity/` — JWT auth guard, @Public() decorator
- `src/common/filters/` — ContractViolationFilter (fire-and-forget Telegram on 500)

## Key patterns
- Auth: ServiceAuthGuard + JWT Bearer — all endpoints except /health require token
- Contracts: Zod schemas via ZodValidationPipe + parseOrThrow()
- Entities: DocumentChunk (chunk metadata) + IngestionJob (sync tracking)
- Qdrant: QdrantService wraps @qdrant/js-client-rest

## Never do
- Never expose /health with auth required
- Never hardcode Vault secrets — always use ESO
- Never store raw embeddings in PostgreSQL (Qdrant only)
- Never write to `src/modules/` — the module structure is flat under `src/ingestion/`, `src/retrieval/` etc.
