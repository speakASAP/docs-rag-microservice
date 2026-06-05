# System: bazos-service

## Architecture

NestJS + PostgreSQL. Bazos.cz automation via web scraping/form submission (no public API).

Multi-container service (Kubernetes `statex-apps`):

| Container | Port | Role |
|-----------|------|------|
| bazos | 3900 | Core service |
| api-gateway | 3901 | JWT auth proxy |
| imports | 3902 | CSV import |
| settings | 3903 | Account settings |
| gateway-proxy | 3904 | Nginx proxy |
| frontend | 3905 | UI |

## Integrations

| Service | Usage |
|---------|-------|
| database-server:5432 | PostgreSQL (`bazos_db`) |
| logging-microservice:3367 | Structured logs |
| catalog-microservice:3200 | Product data |
| warehouse-microservice:3201 | Stock events |
| orders-microservice:3203 | Order forwarding |
| auth-microservice:3370 | JWT validation |

## Events

Subscribes to `stock.updated` (RabbitMQ) → update/pause ads for out-of-stock items.

## Secrets

All secrets in Vault at `secret/prod/bazos-service`.  
K8s: ESO syncs to `bazos-service-secret` every 5 min — see `k8s/external-secret.yaml`.  
Local/Docker: `./shared/scripts/vault-env-gen.sh bazos-service prod`  
→ [../shared/docs/VAULT.md](../shared/docs/VAULT.md)

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/bazos-service:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=bazos-service -f`  
**Restart:** `kubectl rollout restart deployment/bazos-service -n statex-apps`

→ [../shared/docs/DEPLOY_STANDARD.md](../shared/docs/DEPLOY_STANDARD.md)

## Current State
<!-- AI-maintained -->
Stage: production · Deploy: Kubernetes (`statex-apps`)

## Known Issues
<!-- AI-maintained -->
- None
