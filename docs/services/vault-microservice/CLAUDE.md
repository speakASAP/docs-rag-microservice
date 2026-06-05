# CLAUDE.md (vault-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `SYSTEM.md` → `AGENTS.md`

---

## vault-microservice

**Purpose**: HashiCorp Vault — centralized secret management for all Statex services.  
**Port**: 8200 · **Domain**: https://vault.alfares.cz  
**Stack**: HashiCorp Vault 1.15 · Docker (permanent — intentionally NOT in K8s)  
**Storage**: file backend at `/opt/vault/data` (persistent host bind mount)

### Key constraints
- Vault runs in Docker by design — not migrated to K8s (would create a circular dependency)
- Never commit `.vault-init` (unseal key + root token)
- ESO long-lived token is read-only — never give it write permissions
- All secrets live at `secret/prod/<service-name>`
- Never hardcode secrets — always use Vault → ESO → K8s Secret pattern

### Access patterns
- **K8s services**: ESO syncs `secret/prod/<service>` → K8s Secret every 5 min
- **CLI/admin**: `VAULT_ADDR=http://127.0.0.1:8200 vault <command>`
- **Health**: `curl http://localhost:8200/v1/sys/health | jq '{initialized,sealed,version}'`

**Ops**: `./scripts/deploy.sh` · `curl http://localhost:8200/v1/sys/health` · full ops in [`../shared/docs/VAULT.md`](../shared/docs/VAULT.md)
