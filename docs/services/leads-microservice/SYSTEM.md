# System: leads-microservice

## Architecture

NestJS · PostgreSQL · Prisma. Deployed to Kubernetes (`statex-apps` namespace).

- Port: 4400
- Endpoints: `POST /leads`, `GET /leads`, `PATCH /leads/:id`, `GET /health`
- GDPR consent tracked per lead
- Max 30 items per request; do not increase timeouts — check logs

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/leads-microservice:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=leads-microservice -f`

First deploy: create `leads` DB on `database-server`, then `prisma migrate deploy` runs on container start.

## Secrets

All secrets stored in Vault at `secret/prod/leads-microservice`. Synced to K8s via ExternalSecret (`k8s/external-secret.yaml`). Never hardcode secrets.

## Integrations

| Service | Env var | K8s DNS |
|---------|---------|---------|
| PostgreSQL | `DB_HOST` / `DB_*` | `db-server-postgres:5432` |
| logging-microservice | `LOGGING_SERVICE_URL` | `logging-microservice.statex-apps.svc.cluster.local:3367` |
| auth-microservice | `AUTH_SERVICE_URL` | `auth-microservice.statex-apps.svc.cluster.local:3370` |
| notifications-microservice | `NOTIFICATION_SERVICE_URL` | `notifications-microservice.statex-apps.svc.cluster.local:3368` |
| AI microservice | `AI_SERVICE_URL` | `ai-microservice.statex-apps.svc.cluster.local:3380` |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
