# System: docs-rag-microservice

status: validated
completeness_level: validated

## Purpose

Provide bounded semantic discovery over ecosystem Git documentation without becoming a competing source of truth.

## Responsibilities

- Read only repository catalog entries marked docsRag true.
- Reject ingestion triggers unless the requested repository resolves to a catalog entry with docsRag true; use catalog-approved source URLs rather than client-supplied remote URLs.
- Chunk Markdown and MDX, generate Ollama embeddings, and persist chunks in PostgreSQL and vectors in Qdrant.
- Run sequential six-hour ingestion when enabled, skip unchanged sources unless forced, and report failed sources as degraded.
- Read catalog allow-listed mounted repositories at their current checked-out HEAD without fetch, pull, or filesystem writes; retain clone/pull synchronization only for managed writable checkouts.
- Resolve mounted Git HEAD with a command-scoped safe-directory setting and persist the real commit SHA for unchanged-source detection and chunk audit metadata.
- Return token-bounded semantic context with source identity.
- Exclude AppleDouble files and this repository retired docs/services snapshot.
- Authenticate ingestion and retrieval with the service JWT; expose public health and sanitized central logging.

## Non-responsibilities

- Owning ecosystem documentation or overriding owning repositories.
- Replacing graph-first IPS traceability, Git review, deployment configuration, or runtime evidence.
- Treating low-confidence or unavailable retrieval as proof documentation does not exist.
- Operating the deploy queue, triggering ingestion, or modifying Ollama during documentation work.

## Inputs

Catalog-approved Markdown and MDX, authenticated requests, Ollama nomic-embed-text embeddings, and PostgreSQL/Qdrant persistence responses.

## Outputs

Semantic candidates with paths, token-bounded context, docs_rag chunk and job records, ecosystem-docs vectors, sanitized logs, and health status.

## Dependencies

PostgreSQL owns docs_rag chunks and ingestion jobs. Qdrant owns the ecosystem-docs collection. Docker-only ai-microservice-ollama-green on port 11435 supplies embeddings and is not a Kubernetes service. Central logging and the shared repository catalog are also required.

## Upstream traceability

This system implements BUSINESS.md and docs/01_vision/VISION.md: cached bounded discovery saves approximately 2,000-5,000 tokens per avoided raw Git read while preserving Git authority.

## Downstream artifacts

- docs/06_architecture/INTEGRATION_CONTRACT.md
- docs/11_tasks/TASK-001-bootstrap-service.md
- docs/21_execution_plans/EP-TASK-001-bootstrap-service.md
- docs/12_validation/VAL-TASK-001-bootstrap-service.md

## Validation criteria

Health reports ok; catalog filtering and exclusions are applied; ingestion triggers reject repositories that are not catalog-registered with docsRag true (including remote URL requests); allow-listed mounted repositories perform no Git writes and record checked-out HEAD while managed writable repositories still clone/pull; path traversal and client-selected local paths are rejected; guarded routes reject missing JWTs; retrieval preserves source paths and needs Git fallback when unconfident; PostgreSQL migrations and Qdrant access use the stated database and collection.

## Open questions

Scheduled ingestion is disabled by default in .env.example; the deployed ConfigMap controls whether the six-hour schedule is enabled. Catalog currency during service onboarding remains a follow-up in STATE.json.
