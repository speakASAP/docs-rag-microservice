# RAG Service Usage

docs-RAG provides candidate context from approved ecosystem Git repositories.
It is not a documentation store and not an authority layer.

Service calls follow auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md.

## Sources

The canonical source list is:

```text
shared/config/ecosystem-repositories.json
```

Repositories with `docsRag: true` are mounted and indexed directly. There is no
central copied snapshot.

## Authorization

Every caller is a service or an HTTP agent, so access is governed only by
[`auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md):
an Auth-issued, per-pair RS256 service token with an `internal:docs-rag-microservice:*`
role. Never mint one locally, never share one between callers, and never substitute an
API key or a caller-asserted header.

## Endpoints

### Semantic search

```http
POST /retrieval/search
Content-Type: application/json
Authorization: Bearer <service-token>

{
  "query": "deployment standard",
  "limit": 5,
  "repoName": "shared",
  "scoreThreshold": 0.5
}
```

### Agent context

```http
POST /retrieval/agent-context
Content-Type: application/json
Authorization: Bearer <service-token>

{
  "query": "new service integration requirements",
  "maxTokens": 3000,
  "repoName": "shared"
}
```

Internal URL:
`http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`

Public URL: `https://docs-rag.alfares.cz`

## Reading results

- Verify deployment, database, security and public-contract facts against the
  cited Git file.
- `confident: false` means direct Git investigation is required.
- HTTP 503 means retrieval failed; it is not an empty result.
- IPS context is graph-first. Semantic results may enrich a task context but
  cannot replace explicit upstream links.

## Ingestion

Trigger one registered source:

```json
{"repoName":"shared","repoUrl":"local","force":true}
```

Trigger all sources:

```json
{"force":false}
```

Supply authorization through a protected file or process substitution. Never
print or commit the token.

After authoritative documentation changes, verify a distinctive phrase returns
the current repository path. After deleting stale documentation, use a forced
reindex of its owning source so old vectors are removed.
