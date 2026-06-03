#!/bin/bash
# Trigger full ecosystem ingestion into docs-rag-microservice
set -euo pipefail

DOCS_RAG_URL="${DOCS_RAG_URL:-http://docs-rag-microservice.statex-apps.svc.cluster.local:3397}"
JWT_TOKEN="${JWT_TOKEN:-}"
FORCE="${FORCE:-false}"

if [ -z "$JWT_TOKEN" ]; then
  echo "ERROR: JWT_TOKEN env var is required" >&2
  exit 1
fi

echo "Triggering full ecosystem ingestion (force=$FORCE)..."
curl -sf -X POST "$DOCS_RAG_URL/ingestion/trigger-all" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"force\": $FORCE}" | python3 -m json.tool

echo ""
echo "Check status at: $DOCS_RAG_URL/ingestion/status"
