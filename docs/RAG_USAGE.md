# RAG Service Usage Guide

## Why use this service?

Each query to this service instead of reading raw git files saves **2000–5000 tokens**.
With 35 repos indexed, all ecosystem knowledge is searchable in one call.

## Endpoints

All endpoints require `Authorization: Bearer <JWT_TOKEN>` (service-to-service JWT, HS256).

### Semantic search
```
POST /retrieval/search
{
  "query": "how does vault secret rotation work",
  "limit": 5,
  "repoName": "shared",
  "docType": "runbook",
  "scoreThreshold": 0.5
}
```

### Agent context (token-budgeted)
```
POST /retrieval/agent-context
{
  "query": "kubernetes deployment pattern for microservices",
  "maxTokens": 3000,
  "repoName": "shared"
}
```
Returns pre-formatted context block ready to paste into an agent prompt.

## Internal URL (K8s)
`http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`

## Public URL
`https://docs-rag.alfares.cz`

## Trigger re-ingestion
```
POST /ingestion/trigger
{"repoName": "shared", "repoUrl": "local", "localPath": true, "force": true}

POST /ingestion/trigger-all
{"force": false}
```
