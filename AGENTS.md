# AGENTS.md

## Boundaries
- Ingestion agents: trigger via POST /ingestion/trigger (single repo) or POST /ingestion/trigger-all (all 35 repos)
- Retrieval agents: use POST /retrieval/agent-context (token-limited)
- Never query Git directly if this service is running

## Knowledge Retrieval (use before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`
- See: `docs/RAG_USAGE.md` for full usage guide

## Commands
- Build: npm run build
- Test: npm test
- Deploy: bash scripts/deploy.sh
- Trigger all ingestion: JWT_TOKEN=<token> bash scripts/trigger-all-ingestion.sh
