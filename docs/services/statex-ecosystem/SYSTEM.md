# System: statex-ecosystem

## Stack

- **Next.js** (see repo `package.json` for version)
- **Kubernetes** (`statex-apps` namespace, k3s)
- **Traefik v3** for TLS and routing

## Port & Domain

| Role | Value |
|------|-------|
| Port | 4710 |
| Domain | https://statex-ecosystem.alfares.cz |

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/statex-ecosystem:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=statex-ecosystem -f`  
**Restart:** `kubectl rollout restart deployment/statex-ecosystem -n statex-apps`

## Secrets

All secrets in Vault at `secret/prod/statex-ecosystem`.  
Synced via ESO → K8s Secret `statex-ecosystem-secret`.  
See [`../shared/docs/VAULT.md`](../shared/docs/VAULT.md).

## Docs

- Ecosystem tables: [shared/ECOSYSTEM_MAP.md](../shared/ECOSYSTEM_MAP.md)
- Deploy standard: [shared/docs/DEPLOY_STANDARD.md](../shared/docs/DEPLOY_STANDARD.md)

## Current State
<!-- AI-maintained -->
Stage: production · Deploy: Kubernetes (`statex-apps`)
