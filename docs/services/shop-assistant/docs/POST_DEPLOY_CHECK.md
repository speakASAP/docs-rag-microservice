# Post-deploy check (run on server)

After redeploying Shop Assistant (and optionally auth-microservice), run these on the server (e.g. in your SSH session to alfares).

## Quick: one script (recommended)

From the server after `ssh alfares`:

```bash
cd ~/Documents/Github/shop-assistant
./scripts/post-deploy-check.sh
```

This prints: shop-assistant and auth container status, last log lines, and health HTTP codes.

---

## Manual steps

### 1. Service status

```bash
cd ~/Documents/Github/nginx-microservice
./scripts/status-all-services.sh
```

Optional: run with health checks (slower):

```bash
./scripts/status-all-services.sh --health
```

## 2. Shop Assistant container and logs

```bash
# Which shop-assistant container is running (blue or green)
docker ps --filter "name=shop-assistant" --format "table {{.Names}}\t{{.Status}}"

# Last 100 lines of logs (replace with actual container name if different)
docker logs --tail 100 shop-assistant-blue
# or
docker logs --tail 100 shop-assistant-green

# Follow logs live
docker logs -f shop-assistant-blue
```

## 3. Auth-microservice (if deployed)

```bash
docker ps --filter "name=auth" --format "table {{.Names}}\t{{.Status}}"
docker logs --tail 100 auth-microservice-blue
# or auth-microservice-green
```

## 4. Quick HTTP checks (from server)

```bash
# Shop Assistant health
curl -s -o /dev/null -w "%{http_code}" https://shop-assistant.alfares.cz/health

# Auth health (if applicable)
curl -s -o /dev/null -w "%{http_code}" https://auth.alfares.cz/health
```

Expect 200 for healthy.

## 5. Admin token / roles

If the test user (e.g. `test@example.com`) cannot use the Shop Assistant admin panel (prompts, AI models):

- Ensure the user has role `global:superadmin` or `app:shop-assistant:admin` in auth-microservice.
- On the server (from auth-microservice repo): run `./scripts/assign-role-by-email.sh --email=test@example.com --role=global:superadmin` (after `./scripts/seed-rbac.sh` if roles/apps are missing). If the script is not available (e.g. old clone), assign the role via SQL or pull the latest auth-microservice and run the script.
- See `public/getting-admin-token.html` (step-by-step guide) and "Troubleshooting" there.

## 6. If something is down

- Restart shop-assistant: from `nginx-microservice`: `./scripts/blue-green/deploy-smart.sh` with shop-assistant (or use the same deploy flow you used).
- Check logs for errors: `docker logs --tail 200 shop-assistant-blue 2>&1 | grep -i error`
