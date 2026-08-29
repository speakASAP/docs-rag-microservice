# docs-rag-microservice

Derived semantic retrieval over authoritative ecosystem documentation.

Git repositories remain the source of truth. The service reads approved sources
from
[`shared/config/ecosystem-repositories.json`](https://github.com/speakASAP/shared/blob/main/config/ecosystem-repositories.json),
chunks Markdown, creates embeddings with Ollama, stores metadata in PostgreSQL
and vectors in Qdrant.

## Endpoints

- `GET /health` - public health check
- `POST /retrieval/search` - filtered semantic candidates
- `POST /retrieval/agent-context` - token-bounded agent context
- `POST /ingestion/trigger` - ingest one registered source
- `POST /ingestion/trigger-all` - ingest every registered source
- `GET /ingestion/status` - recent ingestion status

Authenticated endpoints require the service-to-service token. Never print it.

## Authority

Read [`docs/SOURCE_OF_TRUTH.md`](docs/SOURCE_OF_TRUTH.md). Retrieval output is
candidate context, not policy. Critical facts must be verified against the
returned Git path.

The service indexes repositories directly. It does not maintain or index a
copied `docs/services/` snapshot.

## Development

```bash
npm test
npm run build
npm run docs:audit
```

Deployment follows the shared runner declared by `deploy.config.sh`.
