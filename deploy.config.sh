# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 (Phase C) for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.

SERVICE_NAME="docs-rag-microservice"
PORT="3397"

IMAGES=(
  "docs-rag-microservice|.||"
)

DEPLOYMENTS=(
  "docs-rag-microservice|app|docs-rag-microservice"
)

# MANIFESTS left at the runner default (configmap, external-secret, deployment,
# service, ingress) — matches the real script's manifest loop exactly.
