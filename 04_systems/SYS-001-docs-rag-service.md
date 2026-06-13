# System: Docs RAG Service

```yaml
id: SYS-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 01_vision/VISION.md
  - 02_business_case/BUSINESS_CASE.md
downstream:
  - 05_subsystems/SUB-001-ingestion.md
  - 05_subsystems/SUB-002-retrieval.md
  - 05_subsystems/SUB-003-service-identity-and-operations.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
  - 07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Purpose
Provide centralized semantic retrieval and token-budgeted agent context over ecosystem documentation.

## Responsibilities
- Ingest markdown documentation from configured ecosystem repositories.
- Chunk, embed, and store documentation vectors and metadata.
- Provide authenticated semantic search and agent-context APIs.
- Expose public health status for platform liveness checks.
- Preserve source repository identity in retrieval output.
- Support Kubernetes deployment with Vault-backed secrets.

## Non-responsibilities
- Owning or approving source repository documentation.
- Returning raw production secrets or records.
- Providing public unauthenticated retrieval.
- Replacing human review for deployment or architecture decisions.

## Inputs
- Repository configuration and local documentation paths.
- Markdown documentation files.
- Retrieval and ingestion API requests.
- JWT secret and service configuration from Vault/Kubernetes environment.

## Outputs
- Qdrant vectors and metadata.
- PostgreSQL ingestion and chunk records.
- Retrieval search responses.
- Agent-context formatted responses.
- Ingestion status records.

## Dependencies
- Node.js 20 and NestJS 11.
- PostgreSQL `docs_rag` database.
- Qdrant `ecosystem-docs` collection.
- Ollama embedding endpoint and configured embedding model.
- Kubernetes namespace `statex-apps` and Vault/ExternalSecret flow.

## Upstream traceability
- Vision: `01_vision/VISION.md`
- Business case: `02_business_case/BUSINESS_CASE.md`
- Goals: `GOALS.md`

## Downstream artifacts
- Subsystems under `05_subsystems/`
- Features under `10_features/`
- Tasks under `11_tasks/`
- Validation reports under `12_validation/`

## Validation
- `npm run build`
- `npm test`
- `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues`
- `python3 scripts/pre_coding_gate.py --root .`
- Deployment health check in `scripts/deploy.sh`

## Open questions
No open system-level questions are known at adoption time.
