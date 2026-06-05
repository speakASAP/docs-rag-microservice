# CLAUDE.md (bazos-service)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## bazos-service

**Purpose**: Bazos.cz classifieds automation — create/update ads, manage multiple accounts, handle ad renewal and expiration.  
**Domain**: https://bazos.alfares.cz  
**Stack**: NestJS · PostgreSQL

### Key constraints
- Bazos anti-spam: max 1 ad per 24h per account per category — strictly enforced
- Never post duplicate ads — check existence before creating
- Ad content must comply with Bazos category rules
- No external API — Bazos uses scraping/form submission; be careful with session management

### Events consumed
- `stock.updated` from warehouse-microservice → removes/updates ads for out-of-stock items

### Secrets
All secrets in Vault at `secret/prod/bazos-service`. → [../shared/docs/VAULT.md](../shared/docs/VAULT.md)

**Ops**: `kubectl logs -n statex-apps -l app=bazos-service -f` · `kubectl rollout restart deployment/bazos-service -n statex-apps` · `./scripts/deploy.sh`
