# Vision

```yaml
id: VISION-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - docs/02_business_case/BUSINESS_CASE.md
  - docs/04_systems/SYS-001-docs-rag-service.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Original Intent
Docs-rag-microservice provides cached ecosystem documentation knowledge through semantic retrieval so agents can ask focused questions instead of reading large sets of raw Git files.

## Vision Goals
- Index documentation from the ecosystem service repositories into a searchable knowledge base.
- Return token-budgeted context blocks that agents can use directly in prompts.
- Preserve service boundaries by keeping each source repository as the documentation source of truth.
- Keep retrieval authenticated and safe for service-to-service use.
- Lower agent token usage by roughly 2,000 to 5,000 tokens per successful retrieval compared with raw file reads.

## Non-Goals
- This service does not replace repository documentation ownership.
- This service does not make RAG output authoritative over approved source docs.
- This service does not expose unauthenticated ingestion or retrieval APIs.
- This service does not store secrets or raw production records in documentation artifacts.

## Success Signals
- All target ecosystem repositories are indexed.
- Retrieval latency remains below the documented service target.
- Agent-context responses are relevant for deployment, Vault, authentication, and Kubernetes queries.
- Qdrant vectors persist across pod restarts.
- Ollama embeddings are reachable from Kubernetes workloads.
- Agents consistently use this service before broad raw Git inspection when the service is available.

## Validation
The vision is validated by `GOALS.md`, retrieval tests, ingestion status checks, Qdrant persistence checks, and IPS deployment-readiness gates.
