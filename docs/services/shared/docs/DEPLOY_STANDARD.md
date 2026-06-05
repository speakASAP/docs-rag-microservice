# Deploy Standard

Services that use nginx-microservice blue/green deployment follow this pattern.

> **K8s services:** Do NOT use `deploy.sh` or blue/green. Use `kubectl apply -f k8s/` — managed by Kubernetes directly.
> **Kubernetes workloads (legacy):** Use `deploy.sh` calling `deploy-smart.sh`.

**Nginx config** lives in the service repo (e.g. `nginx/nginx-api-routes.conf`), never under nginx-microservice. → Full guide: [NGINX_LOCAL_CONFIG.md](./NGINX_LOCAL_CONFIG.md)

**Full deploy.sh checklist:** [DEPLOY_SCRIPT_RULES.md](./DEPLOY_SCRIPT_RULES.md)

## deploy.sh Required Structure

1. `#!/bin/bash` + `set -e`
2. `SCRIPT_DIR`, `PROJECT_ROOT` (not PROJECT_DIR)
3. Colors: `GREEN`/`YELLOW`/`RED`/`BLUE`/`NC` via `\033[0;32m` etc.
4. Source `.env` for `NODE_ENV` and ports
5. Git sync (production only): `git fetch` → optional stash → `git pull` → stash pop
6. Banner: `echo -e "${BLUE}╔══════╗${NC}"` style
7. `SERVICE_NAME` = exact service name
8. NGINX path detection order: `~/Documents/Github/` → `/home/alfares/` → `/home/belunga/` → `$HOME/` → sibling → parent
9. `DEPLOY_SCRIPT=$NGINX_MICROSERVICE_PATH/scripts/blue-green/deploy-smart.sh`
10. `cd "$NGINX_MICROSERVICE_PATH"` then `"$DEPLOY_SCRIPT" "$SERVICE_NAME"`
11. Green ✅ box on success; red ❌ box on failure with hints

## Nginx config files

| File | Location | Purpose |
|------|----------|---------|
| `nginx-api-routes.conf` | `nginx/` in service repo | Route list read by deploy-smart.sh |
| `gateway-proxy.conf` | `nginx/` in service repo | Custom location blocks (optional) |
| `<domain>.conf` | `nginx/` in service repo | Domain-specific config (optional) |

→ Reference implementations: `logging-microservice/scripts/deploy.sh`, `minio-microservice/scripts/deploy.sh`
