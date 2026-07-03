#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-statex-apps}"
CONFIGMAP="${DOCS_RAG_CONFIGMAP:-docs-rag-microservice-config}"
DEPLOYMENT="${DOCS_RAG_DEPLOYMENT:-docs-rag-microservice}"
OLLAMA_CONTAINER="${OLLAMA_CONTAINER:-ai-microservice-ollama-green}"
EXPECTED_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
OLLAMA_URL_OVERRIDE="${OLLAMA_URL:-}"

status=0

print_kv() {
  printf '%s=%s\n' "$1" "$2"
}

print_kv "EMBEDDING_BACKEND_CHECK" "start"
print_kv "namespace" "$NAMESPACE"
print_kv "deployment" "$DEPLOYMENT"
print_kv "expectedModel" "$EXPECTED_MODEL"

configured_url="$OLLAMA_URL_OVERRIDE"
if [ -z "$configured_url" ]; then
  configured_url="$(kubectl -n "$NAMESPACE" get configmap "$CONFIGMAP" -o jsonpath='{.data.OLLAMA_URL}' 2>/dev/null || true)"
fi

if [ -z "$configured_url" ]; then
  print_kv "EMBEDDING_BACKEND_CHECK" "blocked"
  print_kv "reason" "OLLAMA_URL_missing"
  exit 2
fi

print_kv "embeddingBackendUrl" "$configured_url"

if command -v docker >/dev/null 2>&1 && docker inspect "$OLLAMA_CONTAINER" >/dev/null 2>&1; then
  docker_state="$(docker inspect "$OLLAMA_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || true)"
  docker_restart_policy="$(docker inspect "$OLLAMA_CONTAINER" --format '{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || true)"
  print_kv "ollamaContainer" "$OLLAMA_CONTAINER"
  print_kv "ollamaContainerState" "${docker_state:-unknown}"
  print_kv "ollamaRestartPolicy" "${docker_restart_policy:-unknown}"
  if [ "$docker_state" != "running" ]; then
    status=2
    print_kv "containerReason" "ollama_container_not_running"
  fi
else
  print_kv "ollamaContainer" "not_found_or_docker_unavailable"
fi

host_check="$(
  OLLAMA_URL="$configured_url" EXPECTED_MODEL="$EXPECTED_MODEL" node - <<'NODE'
const url = `${process.env.OLLAMA_URL}/api/tags`;
const expected = process.env.EXPECTED_MODEL;
try {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  const models = Array.isArray(payload.models) ? payload.models : [];
  const hasExpected = models.some((model) => String(model.name || model.model || '').startsWith(expected));
  console.log(JSON.stringify({ ok: response.ok && hasExpected, httpStatus: response.status, modelCount: models.length, hasExpected }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error?.message || String(error) }));
}
NODE
)"
print_kv "hostTagsCheck" "$host_check"
if ! printf '%s' "$host_check" | node -e 'let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{const p=JSON.parse(b); process.exit(p.ok ? 0 : 1);})'; then
  status=2
fi

pod_check="$(
  kubectl -n "$NAMESPACE" exec deploy/"$DEPLOYMENT" -- node -e '
const expected = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
const url = `${process.env.OLLAMA_URL}/api/tags`;
try {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  const models = Array.isArray(payload.models) ? payload.models : [];
  const hasExpected = models.some((model) => String(model.name || model.model || "").startsWith(expected));
  console.log(JSON.stringify({ ok: response.ok && hasExpected, httpStatus: response.status, modelCount: models.length, hasExpected }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error?.message || String(error) }));
}
' 2>/dev/null || true
)"
print_kv "podTagsCheck" "$pod_check"
if ! printf '%s' "$pod_check" | node -e 'let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{const p=JSON.parse(b); process.exit(p.ok ? 0 : 1);})'; then
  status=2
fi

if [ "$status" -eq 0 ]; then
  print_kv "EMBEDDING_BACKEND_CHECK" "pass"
else
  print_kv "EMBEDDING_BACKEND_CHECK" "blocked"
fi
exit "$status"
