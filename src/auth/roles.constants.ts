/**
 * docs-RAG role vocabulary.
 *
 * Every route must carry exactly one of these constants, or @Public. Nothing may
 * rely on a guard default: before this existed no route carried any role check at
 * all, so a credential that could read one document could also trigger
 * `POST /ingestion/trigger-all` and re-index every repository in the ecosystem.
 *
 * Two tiers, narrowest first:
 *   READ    - semantic search, agent context, ingestion status. This is what
 *             every consuming service and agent actually needs; nothing else
 *             in this list does.
 *   INGEST  - trigger ingestion. Operator surface, not a service-caller one:
 *             ingestion is self-scheduled on an internal interval, so a normal
 *             consumer never needs to trigger it.
 *
 * `internal:docs-rag-microservice:readonly` is the role minted for per-pair
 * service JWTs from consumers. It deliberately cannot trigger a reindex.
 *
 * Classified by effect, not HTTP verb: both retrieval routes are POST and both
 * are reads.
 */

export const DOCS_RAG_READ_ROLES = [
  'global:superadmin',
  'internal:docs-rag-microservice:admin',
  'internal:docs-rag-microservice:readonly',
] as const;

export const DOCS_RAG_INGEST_ROLES = [
  'global:superadmin',
  'internal:docs-rag-microservice:admin',
  'internal:docs-rag-microservice:ingest',
] as const;
