# AGENTS.md

## Boundaries
- Ingestion agents: trigger via POST /ingestion/trigger
- Retrieval agents: use POST /retrieval/agent-context (token-limited)
- Never query Git directly if this service is running

## Commands
- Build: npm run build
- Test: npm test
- Deploy: kubectl apply -f k8s/ -n statex-apps
