# docs-rag-microservice - System

## Purpose

Provide bounded semantic discovery over ecosystem Git documentation without
becoming a competing source of truth.

## Runtime

- Node.js 20, NestJS 11, TypeScript
- API port 3397
- Public domain `docs-rag.alfares.cz`
- PostgreSQL `docs_rag` database for chunks and ingestion jobs
- Qdrant collection `ecosystem-docs` for vectors and text payloads
- Ollama `nomic-embed-text` embeddings

## Source registry

`src/ingestion/repo-registry.ts` loads the canonical catalog from:

```text
/data/repos/shared/config/ecosystem-repositories.json
```

Only entries with `docsRag: true` are indexed. Checkout aliases and
source-specific exclusions are declared in that catalog. Three local agent
profiles are appended by the service.

The service excludes AppleDouble `._*` files globally and excludes the retired
`docs-rag-microservice/docs/services/` snapshot only for this source.

## Ingestion

- Scheduled every six hours when enabled.
- Sources process sequentially.
- Markdown and MDX are indexed.
- Unchanged committed sources are skipped unless forced.
- Each source is replaced in Qdrant/PostgreSQL during reindex.
- A failed source does not stop the remaining sources, but its result is
  incomplete and must be treated as degraded.

## Retrieval

Retrieval ranks semantic candidates. It does not replace graph-first IPS
traceability, Git review, deployment configuration or runtime evidence.

Responses that are unconfident or unavailable require direct Git fallback.

## Deployment

Kubernetes namespace `statex-apps`; Vault path
`secret/prod/docs-rag-microservice`; shared runner through
`deploy.config.sh`.
