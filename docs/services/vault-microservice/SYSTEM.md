# SYSTEM.md — vault-microservice

## Stack

- **Image**: hashicorp/vault:1.15
- **Storage**: file backend at `/opt/vault/data` (host bind mount, persistent)
- **Auth**: token (admin/CLI), ESO long-lived token (K8s read-only)
- **Port**: 8200 HTTP (TLS terminated by Traefik v3 via cert-manager/Cloudflare DNS-01)
- **Unseal key + root token**: `.vault-init` (gitignored, never commit)

## Secret path convention

```
secret/prod/<service-name>
```

## Architecture

```
vault-microservice (8200)
├── Config: /vault/config/vault.hcl (file storage + TCP listener)
├── Storage: /opt/vault/data (persistent host mount)
└── KV v2 engine at "secret"
    └── secret/prod/<service>/
```

## Purpose

Centralized secret management for all Statex services. Consumers: every K8s microservice (statex-apps namespace) and permanent Docker services (vault-microservice, k8s-registry). Eliminates hardcoded secrets, enables rotation without redeployment.

## Quick ops

```bash
# Health check
curl http://localhost:8200/v1/sys/health | jq '{initialized,sealed,version}'

# Start / auto-unseal
./scripts/deploy.sh

```
