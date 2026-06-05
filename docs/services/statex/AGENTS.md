# Agents: statex


## Knowledge Retrieval (query before reading files)
Query the RAG service first to reuse indexed ecosystem context before reading raw files:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public URL: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`

## Coordinator Config

```yaml
model_tier: smart
cycle_interval_minutes: 60
max_tasks_per_cycle: 10
```

## Worker Pool Config

```yaml
max_concurrent_workers: 5
default_model_tier: cheap
allowed_mcp_servers: [filesystem, postgres, playwright]
```

## Typical Task Types

- generate_business_prototype
- analyze_business_plan
- write_investor_summary

## Active Agents
<!-- Coordinator-maintained -->
None — awaiting business-orchestrator Phase 1 deployment.
