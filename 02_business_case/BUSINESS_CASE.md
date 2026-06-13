# Business Case

```yaml
id: BUS-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 01_vision/VISION.md
downstream:
  - 08_roadmap/ROADMAP.md
  - 22_goal_impact/GOAL-IMPACT-TASK-001.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
```

## Problem
AI agents working across the ecosystem spend unnecessary context budget reading broad repository files when they need targeted documentation answers.

## Users
- AI coding agents working inside ecosystem repositories.
- Platform engineers operating the documentation retrieval service.
- Services that need centralized documentation search or agent-context retrieval.

## Value Proposition
The service reduces token use and repeated raw Git reads by providing cached semantic search and token-limited context packages over ecosystem documentation.

## Success Metrics
- Each successful RAG query saves approximately 2,000 to 5,000 tokens compared with broad file reads.
- Search latency remains below 2 seconds for embedding plus vector search under normal operating conditions.
- All target ecosystem repositories are indexed in Qdrant.
- Agent-context results are relevant for deployment, Vault, authentication, and Kubernetes queries.

## Risks
- Stale indexed documentation can mislead agents if ingestion is not refreshed.
- Missing JWT configuration can block retrieval and ingestion endpoints.
- Embedding model or Qdrant unavailability can reduce service utility.
- Unsafe examples or logs could expose secrets if data handling rules are ignored.

## Validation
Business value is validated through ingestion coverage, retrieval relevance checks, latency checks, and token-saving comparisons documented in validation reports.
