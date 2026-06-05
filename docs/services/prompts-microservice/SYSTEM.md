# System: prompts-microservice

## Service identity

- Service name: `prompts-microservice`
- Domain: `prompts.alfares.cz`
- Runtime: Node.js (Express)
- Port: `4750`

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/prompts-microservice:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=prompts-microservice -f`  
**Restart:** `kubectl rollout restart deployment/prompts-microservice -n statex-apps`

## Dependencies

| Service | Usage |
|---------|-------|
| auth-microservice (`AUTH_SERVICE_URL`) | Login/register/token validation |
| database-server (`DB_*`) | PostgreSQL — prompt persistence |
| logging-microservice (`LOGGING_SERVICE_URL`) | Operational logs |

## Secrets

All secrets in Vault at `secret/prod/prompts-microservice`.  
Synced via ESO → K8s Secret `prompts-microservice-secret`.

## Endpoints

- Web UI: `GET /`
- Health: `GET /api/health`
- Auth API:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Prompt API:
  - `GET /api/prompts`
  - `GET /api/prompts/:id`
  - `POST /api/prompts`
  - `PUT /api/prompts/:id`
  - `DELETE /api/prompts/:id`

## Current State
<!-- AI-maintained -->
Stage: production · Deploy: Kubernetes (`statex-apps`)
