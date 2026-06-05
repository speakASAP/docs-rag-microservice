---
name: nginx-microservice editing rule
description: Never manually edit files under nginx-microservice; use the service's own nginx/ config files and deploy.sh post-deploy to patch generated configs
type: feedback
---

Never manually edit any file under `~/Documents/Github/nginx-microservice/` — it is shared infrastructure and generated configs are overwritten on every deploy.

**Why:** nginx-microservice is production infrastructure shared by all services. Manual edits are lost on next deployment and risk breaking other services.

**How to apply:**

- Service nginx config lives in `<service>/nginx/` (e.g. `nginx/nginx-api-routes.conf`, `nginx/orchestrator.alfares.cz.conf`)
- To fix broken nginx behavior: add a post-deploy block in `scripts/deploy.sh` that uses `sed -i` to patch the generated blue/green conf files, then reloads nginx via `$NGINX_MICROSERVICE_PATH/scripts/reload-nginx.sh`
- Pattern: `minio-microservice/scripts/deploy.sh` (sed-i patching), `agentic-email-processing-system/scripts/deploy.sh` (full-file replacement for short domain)
- Known limitation documented in `shared/docs/NGINX_LOCAL_CONFIG.md §6`: `proxy_pass http://$VAR/path;` strips the URI suffix when host is a variable — fix with `sed -i 's|proxy_pass http://\$TARGET_UPSTREAM/[^;]*;|proxy_pass http://$TARGET_UPSTREAM;|g'`
