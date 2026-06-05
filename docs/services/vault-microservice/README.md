# vault-microservice

HashiCorp Vault instance for the Statex ecosystem. Manages secrets, AppRole auth, and policy enforcement for all microservices.

## What it does

- Stores all production secrets (DB credentials, API keys, tokens)
- Issues AppRole tokens to microservices via Kubernetes ESO (External Secrets Operator)
- Enforces per-service read-only policies

## Quick start

```bash
docker compose up -d
./scripts/init-vault.sh      # first-time setup only — writes .vault-init (gitignored)
./scripts/load-secrets.sh    # load secrets from .env files into Vault
```

## Files

| Path | Purpose |
|------|---------|
| `config/vault.hcl` | Vault server config |
| `policies/` | HCL policy files per role |
| `scripts/init-vault.sh` | First-time init + unseal |
| `scripts/load-secrets.sh` | Bulk load secrets |
| `scripts/backup-cron.sh` | Scheduled snapshot backup |
| `.env.example` | Environment template |

## Security notes

- `.vault-init` (unseal key + root token) is **gitignored** — store it securely offline
- Never commit `.env` or any file containing tokens
- Vault data directory (`vault/data/`) is gitignored
