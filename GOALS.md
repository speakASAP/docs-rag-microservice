# GOALS.md — docs-rag-microservice

## Success Criteria

- [ ] All 35 ecosystem repos indexed (>500 vectors in Qdrant)
- [ ] Search latency < 2s (embedding + vector search)
- [ ] Agent-context endpoint returns relevant results for "deploy", "vault", "auth", "kubernetes" queries
- [ ] Qdrant data persists across pod restarts (hostPath volume)
- [ ] Ollama reachable from K8s pods (0.0.0.0 bind)
- [ ] Token savings: each agent RAG query vs. reading files = ~3000 tokens saved
