# CLAUDE.md (heureka-service)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## heureka-service

**Purpose**: Heureka.cz/sk XML product feed generation from catalog data. Auto-regenerates on stock updates.  
**Domain**: https://heureka.alfares.cz  
**Stack**: NestJS · PostgreSQL · Kubernetes (`statex-apps`)

### Key constraints

- Feed must always be valid XML per Heureka schema — validate before serving
- Never include products with zero stock in the feed
- Feed generation must complete within 60 seconds
- Feed is public — never include internal cost/margin data

### Secrets

All secrets in Vault at `secret/prod/heureka-service` → ESO → K8s Secret. Never hand-write secrets.  
→ [VAULT.md](../shared/docs/VAULT.md)

### Events consumed

- `stock.updated` from warehouse-microservice → triggers feed regeneration

**Ops**: `kubectl logs -f deployment/heureka-service -n statex-apps` · `./scripts/deploy.sh`
