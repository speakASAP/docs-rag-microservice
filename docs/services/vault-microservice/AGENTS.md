> **Vault operational reference:** [`shared/docs/VAULT.md`](../shared/docs/VAULT.md)

# AGENTS.md — vault-microservice


## Knowledge Retrieval (query before reading files)
Query the RAG service first to reuse indexed ecosystem context before reading raw files:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public URL: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`

## Agent capabilities

Agents (automated tools, scripts, or AI systems) may:

- **Read secrets** via Vault CLI: `vault kv get secret/prod/<service>`
- **Write secrets** via Vault CLI: `vault kv put secret/prod/<service> KEY=value`
- **List secret paths**: `vault kv list secret/prod/`
- **Run initialization**: `./scripts/init-vault.sh` (once per setup)
- **Run secret migration**: `./scripts/load-secrets.sh` (once per environment)
- **Run deployment**: `./scripts/deploy.sh`
- **Check Vault health**: `curl http://localhost:8200/v1/sys/health`
- **Generate .env files**: `./shared/scripts/vault-env-gen.sh <service> <env>`

## Off-limits

Agents **must NOT**:

- Store `VAULT_TOKEN` or unseal keys in any tracked Git file
- Commit `.vault-init` file (contains sensitive tokens and unseal keys)
- Disable TLS in production without nginx termination in place
- Write non-secret values to Vault secret paths (use ConfigMap for those)
- Create ad-hoc K8s Secrets manually (ESO manages them automatically)
- Modify Vault policies without explicit authorization

## Authentication

For scripts/CI that need Vault access:

```bash
# Token auth (dev/CI scripts)
export VAULT_TOKEN=$(grep "Initial Root Token" vault-microservice/.vault-init | awk '{print $NF}')
export VAULT_ADDR=http://localhost:8200

# AppRole auth (future hardening, for CI/CD pipelines)
vault write auth/approle/role/ci-role token_num_uses=0 token_ttl=1h
# then: vault read auth/approle/role/ci-role/role-id
```

## Logging and debugging

Enable debug logging:

```bash
export VAULT_LOG_LEVEL=debug
./scripts/deploy.sh
```

Check container logs:

```bash
docker logs vault-microservice
```

## Security considerations

- **Never log VAULT_TOKEN** to stdout or files
- **Never display unseal keys** in public output
- **Always backup .vault-init** outside Git (e.g., encrypted password manager)
- **Rotate long-lived tokens** periodically (default: 90-day TTL)
- **Use AppRole or K8s auth** for production service-to-vault communication instead of token auth
