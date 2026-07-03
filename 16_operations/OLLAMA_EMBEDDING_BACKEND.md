# Ollama Embedding Backend Operations

Docs/RAG uses Ollama-compatible embeddings through `OLLAMA_URL` and
`OLLAMA_EMBEDDING_MODEL`. The current production backend is the Docker container
`ai-microservice-ollama-green` exposed on host port `11435`.

## Readiness

Run the read-only gate:

```bash
npm run readiness:embedding-backend
```

The gate checks:

- configured `OLLAMA_URL` from the Kubernetes ConfigMap;
- Docker container state and restart policy when the container is present;
- host `/api/tags` reachability;
- Docs/RAG pod `/api/tags` reachability;
- expected model prefix, default `nomic-embed-text`.

It does not trigger ingestion and does not print secrets.

## Guarded Repair

When the gate reports a stopped Ollama container, run the guarded repair:

```bash
npm run repair:embedding-backend
CONFIRM=start-ollama-container npm run repair:embedding-backend
```

Without `CONFIRM=start-ollama-container`, the repair prints the failed readiness
evidence and exits blocked. With confirmation, it runs only:

```bash
docker start ai-microservice-ollama-green
```

Then it re-runs the readiness gate. The repair must not run
`/ingestion/trigger`, mutate ConfigMaps or Secrets, print JWTs, or change
database/Qdrant state.

## Consumer Validation

After repair, validate the Cliplot consumer:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && DOCS_RAG_PREFLIGHT_ONLY=1 ./scripts/publish_docs_rag.sh --preflight cliplot'
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:bundle'
```
