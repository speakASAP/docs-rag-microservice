# DEPLOY_SCRIPT_RULES.md

> **K8s services** do NOT use `deploy.sh` or blue/green — use `kubectl apply -f k8s/ -n statex-apps`. This document applies to **legacy Kubernetes workloads** only.

→ Full rules: [DEPLOY_STANDARD.md](DEPLOY_STANDARD.md)

## Do not

- Use `PROJECT_DIR` instead of `PROJECT_ROOT`.
- Use emoji-only output (e.g. 📥, 🚀) without colors and ✅/❌.
- Assume nginx-microservice is only at `../nginx-microservice`; use the full path detection order (see DEPLOY_STANDARD.md §8).
- Use copy-paste comments like "same directory as beauty"; use "sibling directory" or "parent directory".
- Run `docker compose up` first and deploy-smart.sh as an afterthought; deploy-smart.sh is the main deployment entry point.
- Print phase messages twice (e.g. both `>&2` and to stdout).
- Modify `deploy-smart.sh` — it belongs to nginx-microservice and is never edited by services.

## Deploy checklist

- [ ] Shebang `#!/bin/bash` and `set -e`
- [ ] `SCRIPT_DIR` and `PROJECT_ROOT` only (no `PROJECT_DIR`)
- [ ] Colors: `GREEN`, `YELLOW`, `RED`, `BLUE`, `NC`
- [ ] Load `.env` for `NODE_ENV` (use `set -a` / `source` / `set +a`; handle missing file)
- [ ] Optional git sync when `NODE_ENV=production` (`git fetch` → stash if needed → `git pull` → stash pop)
- [ ] Banner (BLUE box, no extra spaces, title matches service name)
- [ ] `SERVICE_NAME` = exact service name (e.g. `minio-microservice`)
- [ ] NGINX path detection in standard order: `~/Documents/Github/` → `/home/alfares/` → `/home/belunga/` → `$HOME/` → sibling → parent
- [ ] Error message when not found: list all paths + `export NGINX_MICROSERVICE_PATH=...` hint, then `exit 1`
- [ ] `DEPLOY_SCRIPT=$NGINX_MICROSERVICE_PATH/scripts/blue-green/deploy-smart.sh`; `-f` check; `chmod +x` if not executable
- [ ] Print "✅ Found nginx-microservice at: $NGINX_MICROSERVICE_PATH" and "✅ Deploying service: $SERVICE_NAME"
- [ ] Optional pre-deploy steps (cleanup, remove old nginx config, stop own containers)
- [ ] Optional docker-compose config validation (`docker compose -f ... config --quiet`)
- [ ] `cd "$NGINX_MICROSERVICE_PATH"` then `"$DEPLOY_SCRIPT" "$SERVICE_NAME"`
- [ ] Source `shared/scripts/load-deploy-phase-timing.sh` with `"$PROJECT_ROOT"` (loads `deploy-phase-timing.sh`)
- [ ] Call `deploy_timing_init "$SERVICE_NAME"` then `deploy_timing_phase_start` / `deploy_timing_phase_end` per step
- [ ] End with `deploy_timing_finish_success` (prints phase table + total seconds)
- [ ] Blue/green wrappers: `deploy_timing_exec_deploy_smart "$DEPLOY_SCRIPT" "$SERVICE_NAME"` after pre-checks
- [ ] K8s rollout wait: `deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"`
- [ ] Phase logs: single `echo >&2` per phase marker (no duplicate stdout)
- [ ] Success: green ✅ box; failure: red ❌ box with hints (registry, health check, port)
- [ ] Optional post-deploy steps (copy nginx config, substitute placeholders, reload nginx)
