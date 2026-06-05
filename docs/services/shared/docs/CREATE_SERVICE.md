# Create New Microservice

## Required Outputs

- `README.md`
- `docs/` (integration + API docs)
- `.env` and `.env.example` (keys only in example) — see [ENV_FILE_STANDARD.md](./ENV_FILE_STANDARD.md)
- `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/external-secret.yaml` (K8s-first)
- `scripts/deploy.sh` (blue/green, for legacy Kubernetes fallback) — see [DEPLOY_STANDARD.md](./DEPLOY_STANDARD.md)
- `nginx/nginx-api-routes.conf`

> Kubernetes files (`docker-compose.yml`, `.blue.yml`, `.green.yml`) are legacy only. New services target K8s.

## Vault + K8s Setup (Required)

```bash
# 1. Write secrets to Vault
export VAULT_ADDR=http://192.168.88.53:8200
export VAULT_TOKEN=$(grep "Initial Root Token" vault-microservice/.vault-init | awk '{print $NF}')
vault kv put secret/prod/<service-name> KEY=value KEY2=value2

# 2. Create external secret from template
cp shared/k8s/external-secrets/external-secret.yaml.tpl <service-name>/k8s/external-secret.yaml
# Edit: metadata.name + target.name → <service-name>-secret; data[] → your keys

# 3. Apply and verify (STATUS must be SecretSynced)
kubectl apply -f k8s/external-secret.yaml -n statex-apps
kubectl get externalsecret <service-name>-secret -n statex-apps

# 4. Reference in deployment.yaml
# envFrom:
#   - configMapRef: { name: <service-name>-config }
#   - secretRef:    { name: <service-name>-secret }
```

Local dev: `./shared/scripts/vault-env-gen.sh <service-name> prod`

## Hard Rules

- Do not modify production-ready services: `database-server`, `auth-microservice`, `nginx-microservice`, `logging-microservice`
- No hardcoded URLs, API keys, or credentials in code
- Vault is the source of truth for secrets; `.env` is for local/Kubernetes only
- Install secret-scanning pre-commit hook: `./shared/scripts/install-hooks.sh /path/to/new-service`

## Shared Microservices

Integrate via `.env` vars: `AUTH_SERVICE_URL`, `LOGGING_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `AI_SERVICE_URL`, `DB_*`, `REDIS_*`

## Deployment

- K8s: `kubectl apply -f k8s/` in namespace `statex-apps`
- Kubernetes (legacy): blue/green via `nginx-microservice/scripts/blue-green/deploy-smart.sh`
- Set `SERVICE_NAME` and `DOMAIN` in `.env` for RBAC auto-registration

## RBAC + Auth

- Applications auto-register in `auth-microservice` on deploy
- Name ending in `-microservice` → `internal`; `database-server` → `infrastructure`; else → `user_facing`
- User-facing apps must expose Login/Register via auth-microservice
- → [RBAC_USAGE_GUIDE.md](./RBAC_USAGE_GUIDE.md) | [AUTH_FRONTEND_INTEGRATION.md](./AUTH_FRONTEND_INTEGRATION.md)

## Logging

Send structured logs to `LOGGING_SERVICE_URL`. Include `timestamp` (ISO 8601) and `duration_ms` in every entry.
