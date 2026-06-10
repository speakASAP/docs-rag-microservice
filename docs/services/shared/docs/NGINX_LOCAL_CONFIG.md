# Local Nginx Config for Microservices and Applications

All nginx configuration that belongs to a **service or application** must live in **that service’s codebase**, not in nginx-microservice. During deployment, nginx-microservice configs are regenerated from the service registry and from files it reads in each service’s directory. Any manual edits under nginx-microservice will be overwritten on the next deployment.

This document describes where to store local nginx config, how it is used, naming rules, and how to pass it into nginx-microservice via `deploy.sh`.

---

## 1. Why config lives in the application/microservice repo

- **nginx-microservice is production-ready** and must not be modified by services.
- **Deployments regenerate** nginx config from the service registry and from files under each service’s path (e.g. `PRODUCTION_BASE_PATH` / `service-registry` `production_path`).
- **Single source of truth**: API routes, domain-specific configs, and optional snippets are versioned with the service and applied consistently on every deploy.

---

## 2. Where to store local nginx config

All of the following live **inside the application or microservice repository**, not in nginx-microservice.

| Config type | Recommended path in service repo | Alternative path |
|------------|----------------------------------|-----------------|
| API routes list | `nginx/nginx-api-routes.conf` | `nginx-api-routes.conf` (repo root) |
| Optional location snippet | `nginx/gateway-proxy.conf` | — |
| Domain-specific server block(s) | `nginx/<short-domain>.<base-domain>.conf` (e.g. `nginx/aeps.alfares.cz.conf`) | — |
| Optional JSON overrides | `nginx/nginx.config.json` (e.g. `client_max_body_size`) | — |

**Naming rules:**

- **nginx-api-routes.conf** – Exact name. No `server { }` or `location { }`; only route paths, one per line.
- **gateway-proxy.conf** – Same filename across services for consistency; content is service-specific.
- **Domain configs** – One file per extra domain; name = `<short-domain>.<base-domain>.conf` (e.g. `aeps.alfares.cz.conf`). Use a single template with a placeholder (e.g. `{{AEPS_UPSTREAM}}`) so you don’t need separate .blue/.green files.

---

## 3. How config is passed to nginx-microservice

### 3.1 nginx-api-routes.conf (no copy; read by deploy-smart.sh)

- **Stored in service:** `{service}/nginx/nginx-api-routes.conf` or `{service}/nginx-api-routes.conf`.
- **How it’s used:** When you run `./scripts/deploy.sh` (or `deploy-smart.sh $SERVICE_NAME` from nginx-microservice), deploy-smart.sh resolves the service path from the registry (`production_path`, e.g. `~/Documents/Github/allegro-service`) and **reads** the file from that path. It updates the service registry’s `api_routes` or `frontend_api_routes` and the nginx config generator emits the corresponding location blocks.
- **No copy step:** The file must exist in the repo and be present at the service path on the server when deploy runs (normal git pull before deploy is enough).

**Lookup order used by deploy-smart.sh:**

1. `{service_path}/nginx/nginx-api-routes.conf`
2. `{service_path}/nginx-api-routes.conf`

**Format:** One route per line; lines starting with `#` and empty lines are ignored. Routes must start with `/` (e.g. `/api/...` or `/`).

### 3.2 Domain-specific or extra server configs (copy in deploy.sh post-deploy)

- **Stored in service:** e.g. `nginx/aeps.alfares.cz.conf`.
- **How it’s used:** The **application’s** `scripts/deploy.sh` must **copy** this file into nginx-microservice **after** `deploy-smart.sh` succeeds (post-deploy step). Use a placeholder (e.g. `{{AEPS_UPSTREAM}}`) and substitute the active upstream (e.g. `agentic-email-processing-system-blue` or `-green`) when copying. Then reload nginx.
- **Destination:** `$NGINX_MICROSERVICE_PATH/nginx/conf.d/<same-filename>.conf` (e.g. `aeps.alfares.cz.conf`). Same naming pattern as other domain configs in `conf.d/`.

**Example (agentic-email-processing-system):**

- Source: `$PROJECT_ROOT/nginx/aeps.alfares.cz.conf` (contains `{{AEPS_UPSTREAM}}`).
- After deploy: detect active color from the main domain symlink, set `AEPS_UPSTREAM=agentic-email-processing-system-{blue|green}`, run `sed "s/{{AEPS_UPSTREAM}}/$AEPS_UPSTREAM/g" "$AEPS_SRC" > "$NGINX_MICROSERVICE_PATH/nginx/conf.d/aeps.alfares.cz.conf"`, then run `$NGINX_MICROSERVICE_PATH/scripts/reload-nginx.sh`.

### 3.3 gateway-proxy.conf (optional)

- **Stored in service:** `nginx/gateway-proxy.conf`.
- **Content:** Snippet with `location` blocks only (no `server { listen ... }`) when included under a server block; or a full server block if the service acts as an internal API gateway.
- **How it’s used:** Currently the nginx-microservice config generator does not automatically include this file. If you need custom location blocks (e.g. S3 webhook, health, fallback), either:
  - Rely on **nginx-api-routes.conf** for path-based routing where possible, or
  - In **post-deploy** in `deploy.sh`, copy `nginx/gateway-proxy.conf` into nginx-microservice (e.g. to `nginx/conf.d/` or a dedicated includes path) and ensure it is included by a config that is not overwritten by the generator. Document the copy step in the service’s README.

### 3.4 nginx.config.json (optional)

- **Stored in service:** `nginx/nginx.config.json` (e.g. `client_max_body_size`).
- **How it’s used:** deploy-smart.sh (via utils.sh) can read this from the service path and update the registry or generation. No copy to nginx-microservice; it is read from the service directory.

---

## 4. Summary: what deploy.sh must do

1. **Always:** Run `deploy-smart.sh` from nginx-microservice (e.g. `cd "$NGINX_MICROSERVICE_PATH" && ./scripts/blue-green/deploy-smart.sh "$SERVICE_NAME"`). That script reads `nginx-api-routes.conf` (and optionally `nginx.config.json`) from the **service path** and regenerates blue/green configs.
2. **If the service has domain-specific or extra server configs:** After deploy-smart.sh succeeds, copy from `$PROJECT_ROOT/nginx/<file>.conf` to `$NGINX_MICROSERVICE_PATH/nginx/conf.d/<file>.conf`, substitute placeholders (e.g. upstream name), then run `$NGINX_MICROSERVICE_PATH/scripts/reload-nginx.sh`.
3. **Optional:** Pre-deploy cleanup (e.g. remove stale service-specific configs from `nginx-microservice/nginx/conf.d/` to avoid conflicts), or copy `gateway-proxy.conf` in post-deploy if needed.

---

## 5. Do not

- **Do not** edit nginx config under nginx-microservice by hand for a service; the next deployment will overwrite generated configs.
- **Do not** create or edit `service-registry/*.json` in the service repo; the registry is managed by nginx-microservice deploy-smart.sh.
- **Do not** put `server_name` for the same domain in two different config files (causes nginx “conflicting server name” warnings). Use one config per domain; for short domains (e.g. aeps.alfares.cz), use a single template with placeholder and copy it in post-deploy.

---

## 6. Known limitation: proxy_pass with variable host drops the URI suffix

**Symptom:** Nested REST routes (e.g. `GET /api/businesses/:id`) return the wrong response — they appear to hit the list/root endpoint instead of the specific resource.

**Cause:** The nginx-microservice generator emits location blocks like:

```nginx
location /api/businesses {
    set $TARGET_UPSTREAM service-blue;
    proxy_pass http://$TARGET_UPSTREAM/api/businesses;  ← broken
}
```

When `proxy_pass` contains a variable in the host part (`$TARGET_UPSTREAM`), nginx cannot perform URI substitution at config-parse time. At runtime it forwards only the literal path from the directive (`/api/businesses`), discarding the request URI suffix. A request to `/api/businesses/abc/projects` arrives at the container as `/api/businesses`.

**Fix pattern (used by runlayer, minio-microservice):** In the service's `deploy.sh` post-deploy block, use `sed -i` to strip the path suffix from all `proxy_pass` directives in the generated blue/green configs, then reload nginx:

```bash
for _conf in "$NGINX_BG_DIR/${DOMAIN}.blue.conf" "$NGINX_BG_DIR/${DOMAIN}.green.conf"; do
  [ -f "$_conf" ] && \
    sed -i 's|proxy_pass http://\$TARGET_UPSTREAM/[^;]*;|proxy_pass http://$TARGET_UPSTREAM;|g' "$_conf"
done
"$NGINX_MICROSERVICE_PATH/scripts/reload-nginx.sh"
```

Without a path component, nginx forwards the full request URI to the upstream unchanged.

**Reference files:** `runlayer/scripts/deploy.sh` (post-deploy block), `runlayer/nginx/runlayer.alfares.cz.conf` (correct config shape), `minio-microservice/scripts/deploy.sh` (same pattern for S3 routes).

---

## 7. Reference

- **Deploy script standard:** [DEPLOY_STANDARD.md](./DEPLOY_STANDARD.md)  
- **Deploy script rules (checklist):** [DEPLOY_SCRIPT_RULES.md](./DEPLOY_SCRIPT_RULES.md)  
- **API routes registration:** nginx-microservice [docs/API_ROUTES_REGISTRATION.md](../../nginx-microservice/docs/API_ROUTES_REGISTRATION.md) (sibling repo)  
- **Example deploy.sh with post-deploy config copy:** `agentic-email-processing-system/scripts/deploy.sh`  
- **Example nginx-api-routes.conf:** `statex/nginx/nginx-api-routes.conf`, `agentic-email-processing-system/nginx/nginx-api-routes.conf`  
- **Example domain config template:** `agentic-email-processing-system/nginx/aeps.alfares.cz.conf`  
- **Example proxy_pass patch (nested REST routes):** `runlayer/scripts/deploy.sh`, `minio-microservice/scripts/deploy.sh`
