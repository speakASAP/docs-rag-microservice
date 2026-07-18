# Constitution

```yaml
id: CONST-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream: []
downstream:
  - docs/01_vision/VISION.md
  - docs/17_governance/PROJECT_INVARIANTS.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Purpose
This constitution defines non-negotiable delivery rules for docs-rag-microservice.

## Project Laws
- The service exists to provide centralized, authenticated documentation retrieval for AI agents and ecosystem services.
- Documentation retrieval must reduce direct raw Git reads by agents when the service is available.
- `/health` is the only public endpoint; ingestion and retrieval endpoints require service-to-service JWT authentication.
- RAG output is advisory context for agents, not an authority that overrides service source repositories or approved documentation.
- Secrets and production credentials must remain in Vault and Kubernetes Secret flows, not in repository docs, examples, prompts, tests, logs, or reports.
- Operational changes must preserve traceability to business goals, validation evidence, and deployment rollback capability.

## Immutable Scope
AI agents must not edit this file after adoption. Human intent changes belong in `docs/01_vision/VISION_EVOLUTION.md` and require owner review.

## Validation
Deployment readiness must verify this file exists and was not changed by unreviewed implementation work.
