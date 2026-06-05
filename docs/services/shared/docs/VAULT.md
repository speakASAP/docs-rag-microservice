# Vault — Secret Management

HashiCorp Vault 1.15 at `http://192.168.88.53:8200`. All production secrets live here.

## Secret paths

```
secret/prod/<service-name>
```

## How secrets reach services

| Mode | Flow |
|------|------|
| **K8s (production)** | Vault → ESO → K8s Secret (`<svc>-secret`) → pod `envFrom` |
| **Kubernetes / local dev** | Vault → `./shared/scripts/vault-env-gen.sh <svc> prod` → `.env` |

> K8s pods never read `.env`. ESO polls every **5 min**. Force sync:
> `kubectl annotate externalsecret <svc>-secret force-sync=$(date +%s) -n statex-apps --overwrite`

## Authenticate

```bash
export VAULT_ADDR=http://192.168.88.53:8200
export VAULT_TOKEN=$(grep "Initial Root Token" \
  /home/ssf/Documents/Github/vault-microservice/.vault-init | awk '{print $NF}')
```

## Quick ops

```bash
vault kv get secret/prod/<svc>                          # view secrets
vault kv patch secret/prod/<svc> KEY=value              # add/update (K8s: auto-syncs in 5 min)
vault kv list secret/prod/                              # list all services
./shared/scripts/vault-env-gen.sh <svc> prod            # generate .env (local/Docker)
kubectl get externalsecrets -n statex-apps              # check ESO sync status
```

## Onboard new K8s service

```bash
vault kv put secret/prod/<svc> KEY=val KEY2=val2
cp shared/k8s/external-secrets/external-secret.yaml.tpl <svc>/k8s/external-secret.yaml
# Edit: metadata.name, target.name → <svc>-secret; data[] → list your keys
kubectl apply -f <svc>/k8s/external-secret.yaml -n statex-apps
```

## Troubleshoot

```bash
kubectl describe externalsecret <svc>-secret -n statex-apps  # most common: key missing in Vault
curl http://192.168.88.53:8200/v1/sys/health | jq '{initialized,sealed}'  # sealed=false = healthy
cd vault-microservice && ./scripts/deploy.sh                  # if sealed after restart
```

→ Full ops reference (backup, restore, disaster recovery, scripts): [KUBERNETES_SETUP_GUIDE.md](KUBERNETES_SETUP_GUIDE.md)
