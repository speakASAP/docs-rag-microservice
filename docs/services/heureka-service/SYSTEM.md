# System: heureka-service

## Stack

NestJS · PostgreSQL · Kubernetes (statex-apps namespace)

## Deployment

**Mode:** Kubernetes (k3s, `statex-apps` namespace)  
**Deploy:** `./scripts/deploy.sh` (builds image, pushes to registry, triggers rollout)  
**Image:** `localhost:5000/heureka-service:latest`  
**Port:** 3000 (ClusterIP) → ingress → `heureka.alfares.cz`

```bash
kubectl rollout restart deployment/heureka-service -n statex-apps
kubectl logs -f deployment/heureka-service -n statex-apps
kubectl get pods -n statex-apps -l app=heureka-service
```

## Secrets

All secrets in Vault at `secret/prod/heureka-service` → ESO → K8s Secret `heureka-service-secret`.

| Secret key | Purpose |
|------------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Auth token signing |
| `PAYMENT_API_KEY` | Payment provider |
| `PAYMENT_APPLICATION_ID` | Payment provider |
| `PAYMENT_WEBHOOK_API_KEY` | Payment webhook verification |

```bash
# View secrets
vault kv get secret/prod/heureka-service
# Force ESO re-sync
kubectl annotate externalsecret heureka-service-secret force-sync=$(date +%s) -n statex-apps --overwrite
```

→ Vault ops: [../shared/docs/VAULT.md](../shared/docs/VAULT.md)

## Integrations

| Service | Address | Usage |
|---------|---------|-------|
| database-server | db-server-postgres.statex-apps.svc.cluster.local:5432 | PostgreSQL (`heureka` DB) |
| logging-microservice | :3367 | Structured logs |
| catalog-microservice | :3200 | Product data |
| warehouse-microservice | :3201 | `stock.updated` events |

## Database

DB: `heureka` · Tables: `HeurekaFeed`, `HeurekaProduct`, `HeurekaSettings`

## Architecture

- Subscribes to `stock.updated` (RabbitMQ) → regenerates feed
- Supports Heureka.cz and Heureka.sk feed types
- Stores feed generation history

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
None
