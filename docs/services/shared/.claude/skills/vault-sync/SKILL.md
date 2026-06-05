---
name: vault-sync
description: Verify the full Vault → ESO → K8s secret pipeline for a Statex service. Checks: Vault path exists, ESO ExternalSecret status, K8s Secret exists, pod env var injection. Usage: /vault-sync <service-name>
disable-model-invocation: true
---

Run the 3-step secret pipeline check for a given Statex microservice.

## Usage

```
/vault-sync auth-microservice
/vault-sync payments-microservice
```

## Prerequisites

Vault must be unsealed. If commands return 403/connection refused:
```bash
# Check Vault status
VAULT_ADDR=http://127.0.0.1:8200 vault status
# Unseal key is in vault-microservice/.vault-init
```

## Step 1: Vault — does the secret path exist?

```bash
VAULT_ADDR=http://127.0.0.1:8200 vault kv list secret/prod/<service-name> 2>/dev/null || echo "PATH NOT FOUND"
VAULT_ADDR=http://127.0.0.1:8200 vault kv get -format=json secret/prod/<service-name> 2>/dev/null | jq '.data.data | keys' 2>/dev/null || echo "Cannot read secret"
```

Expected: list of key names present. If missing → secret was never written to Vault.

## Step 2: ESO — is ExternalSecret synced?

```bash
kubectl get externalsecret -n statex-apps 2>/dev/null | grep <service-name>
kubectl describe externalsecret <service-name> -n statex-apps 2>/dev/null | grep -A5 "Status:"
```

Look for `Ready: True` and `SecretSynced`. If status shows error:
- `InvalidStore` → SecretStore config broken
- `NoSecretData` → Vault path missing (go back to Step 1)
- `Forbidden` → Vault policy doesn't allow ESO to read this path

## Step 3: K8s Secret — does it exist and have the expected keys?

```bash
kubectl get secret <service-name> -n statex-apps 2>/dev/null || echo "K8s Secret NOT FOUND"
kubectl get secret <service-name> -n statex-apps -o json 2>/dev/null | jq '.data | keys' 2>/dev/null
```

Expected: all keys from `.env.example` should be present. Compare:
```bash
cat /home/ssf/Documents/Github/<service-name>/.env.example | grep -v '^#' | grep '=' | cut -d= -f1 | sort
```

## Step 4: Pod — are env vars injected?

```bash
kubectl exec -n statex-apps deployment/<service-name> -c app -- env 2>/dev/null | grep -E 'DB_|REDIS_|JWT_|API_KEY' | head -20
```

If pod is not running, check events:
```bash
kubectl describe pod -n statex-apps -l app=<service-name> 2>/dev/null | tail -20
```

## Output format

```
VAULT SYNC CHECK — <service-name>

Step 1 — Vault path:     ✅ exists (12 keys) | ❌ MISSING
Step 2 — ESO sync:       ✅ Ready | ❌ ERROR: <reason>
Step 3 — K8s Secret:     ✅ exists (12 keys) | ❌ MISSING
Step 4 — Pod env vars:   ✅ injected | ⚠️ pod not running

DIAGNOSIS: [all green | specific failure point + fix command]
```

## Common fixes

| Problem | Fix |
|---------|-----|
| Vault path missing | `VAULT_ADDR=http://127.0.0.1:8200 vault kv put secret/prod/<svc> KEY=value` |
| ESO not syncing | `kubectl annotate externalsecret <svc> -n statex-apps force-sync=$(date +%s) --overwrite` |
| K8s Secret stale | Delete and let ESO recreate: `kubectl delete secret <svc> -n statex-apps` |
| Pod not picking up new secret | `bash /home/ssf/Documents/Github/shared/scripts/k8s-quick.sh restart <svc>` |
| Check rollout status after restart | `bash /home/ssf/Documents/Github/shared/scripts/k8s-deploy.sh rollout status <svc>` |
