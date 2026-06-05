# System: marketing-microservice

## Architecture

NestJS + PostgreSQL. Kubernetes (`statex-apps` namespace).  
**Port**: 4600 · **Domain**: https://marketing.alfares.cz

- Segments: auth users, leads, order-based
- Campaign engine: scheduling, throttling, consent, unsubscribe
- All delivery via notifications-microservice

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/marketing-microservice:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=marketing-microservice -f`  
**Restart:** `kubectl rollout restart deployment/marketing-microservice -n statex-apps`

## Integrations

| Service | Usage |
|---------|-------|
| database-server:5432 | PostgreSQL |
| logging-microservice:3367 | Logs |
| auth-microservice:3370 | User segments |
| leads-microservice:4400 | Lead segments |
| notifications-microservice:3368 | Delivery |
| orders-microservice:3203 | Order-based segments |

## Current State
<!-- AI-maintained -->
Stage: production · Deploy: Kubernetes (`statex-apps`)

## Known Issues
<!-- AI-maintained -->
- None
