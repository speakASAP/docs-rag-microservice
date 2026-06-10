#!/bin/bash
# deploy.sh — Kubernetes deployment for docs-rag-microservice
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="docs-rag-microservice"
NAMESPACE="${NAMESPACE:-statex-apps}"
REGISTRY="localhost:5000"
HEALTH_PORT="${PORT:-3397}"
HEALTH_PATH="/health"
HEALTH_MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-30}"
HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-2}"

DEFAULT_TAG="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "build-$(date -u +%Y%m%d%H%M%S)")"
IMAGE_TAG="${1:-$DEFAULT_TAG}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"

# shellcheck disable=SC1091
source "$(dirname "$PROJECT_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" \
  || { echo -e "${RED}Error: deploy timing library not found${NC}" >&2; exit 1; }
deploy_timing_init "$SERVICE_NAME"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║      Docs RAG Microservice - Kubernetes Deployment     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "${NODE_ENV:-}" = "production" ]; then
  deploy_timing_phase_start "Git sync"
  cd "$PROJECT_ROOT"
  git fetch origin
  git stash || true
  git pull origin main
  git stash pop || true
  deploy_timing_phase_end "Git sync"
fi

deploy_timing_phase_start "Build image"
docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
deploy_timing_phase_end "Build image"

deploy_timing_phase_start "Push image"
docker push "$IMAGE"
docker push "$IMAGE_LATEST"
deploy_timing_phase_end "Push image"

deploy_timing_phase_start "Apply Qdrant"
kubectl apply -f "$PROJECT_ROOT/k8s/qdrant-deployment.yaml" -n "$NAMESPACE"
deploy_timing_k8s_rollout_wait kubectl qdrant "$NAMESPACE"
deploy_timing_phase_end "Apply Qdrant"

deploy_timing_phase_start "Apply K8s manifests"
kubectl apply -f "$PROJECT_ROOT/k8s/external-secret.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/deployment.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/service.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "$NAMESPACE"
deploy_timing_phase_end "Apply K8s manifests"

deploy_timing_phase_start "Update deployment image"
kubectl set image "deployment/${SERVICE_NAME}" app="$IMAGE_LATEST" -n "$NAMESPACE"
kubectl rollout restart "deployment/${SERVICE_NAME}" -n "$NAMESPACE"
deploy_timing_phase_end "Update deployment image"

deploy_timing_phase_start "Wait for rollout"
deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"
deploy_timing_phase_end "Wait for rollout"

deploy_timing_phase_start "Health check"
attempt=1
while [ "${attempt}" -le "${HEALTH_MAX_ATTEMPTS}" ]; do
  POD=$(kubectl get pod -n "${NAMESPACE}" \
    -l "app=${SERVICE_NAME}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [ -z "${POD}" ]; then
    echo -e "${RED}❌ No pod found for ${SERVICE_NAME}${NC}"
    exit 1
  fi
  if kubectl exec -n "${NAMESPACE}" "${POD}" -- node -e \
    "fetch('http://127.0.0.1:${HEALTH_PORT}${HEALTH_PATH}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    2>/dev/null; then
    echo -e "${GREEN}✅ Health check OK${NC}"
    break
  fi
  if [ "${attempt}" -eq "${HEALTH_MAX_ATTEMPTS}" ]; then
    echo -e "${RED}❌ Health check failed after ${HEALTH_MAX_ATTEMPTS} attempts${NC}"
    exit 1
  fi
  echo -e "${YELLOW}   attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}, retry in ${HEALTH_INTERVAL_SEC}s...${NC}"
  sleep "${HEALTH_INTERVAL_SEC}"
  attempt=$((attempt + 1))
done
deploy_timing_phase_end "Health check"

deploy_timing_finish_success "$SERVICE_NAME"
echo "Image:     ${IMAGE}"
echo "Namespace: ${NAMESPACE}"
echo "Service:   https://docs-rag.alfares.cz"
DEPLOY_TIMING_FINISHED=1
exit 0
