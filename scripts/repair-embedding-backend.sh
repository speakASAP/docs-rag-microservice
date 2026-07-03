#!/usr/bin/env bash
set -euo pipefail

OLLAMA_CONTAINER="${OLLAMA_CONTAINER:-ai-microservice-ollama-green}"
CONFIRM="${CONFIRM:-}"

echo "EMBEDDING_BACKEND_REPAIR=start"
echo "repairMode=guarded_ollama_container_start_only"
echo "forbiddenOperations=no_ingestion_trigger,no_secret_print,no_configmap_mutation,no_database_mutation"

if bash scripts/check-embedding-backend.sh >/tmp/docs-rag-embedding-backend-before.log 2>&1; then
  cat /tmp/docs-rag-embedding-backend-before.log
  echo "EMBEDDING_BACKEND_REPAIR=noop_already_healthy"
  exit 0
fi

cat /tmp/docs-rag-embedding-backend-before.log

if [ "$CONFIRM" != "start-ollama-container" ]; then
  echo "EMBEDDING_BACKEND_REPAIR=blocked"
  echo "reason=confirmation_required"
  echo "requiredConfirm=start-ollama-container"
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "EMBEDDING_BACKEND_REPAIR=blocked"
  echo "reason=docker_unavailable"
  exit 2
fi

if ! docker inspect "$OLLAMA_CONTAINER" >/dev/null 2>&1; then
  echo "EMBEDDING_BACKEND_REPAIR=blocked"
  echo "reason=ollama_container_not_found"
  echo "container=$OLLAMA_CONTAINER"
  exit 2
fi

docker start "$OLLAMA_CONTAINER" >/dev/null
sleep 3

if bash scripts/check-embedding-backend.sh; then
  echo "EMBEDDING_BACKEND_REPAIR=pass"
else
  echo "EMBEDDING_BACKEND_REPAIR=blocked_after_start"
  exit 2
fi
