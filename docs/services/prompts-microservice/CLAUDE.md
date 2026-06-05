# CLAUDE.md (prompts-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## prompts-microservice

**Purpose**: Prompt management library — create, store, and retrieve AI prompt templates used across the Statex ecosystem.  
**Port**: 4750 · **Domain**: https://prompts.alfares.cz  
**Stack**: Node.js (Express) · PostgreSQL · Kubernetes (`statex-apps`)

### Key constraints
- All prompt CRUD requires authenticated user (JWT via auth-microservice)
- Never expose raw DB credentials — use Vault-sourced secrets only
- Prompt content is user-owned — no cross-user reads without admin role

### Key integrations
| Service | Usage |
|---------|-------|
| auth-microservice:3370 | JWT auth |
| logging-microservice:3367 | Operational logs |

**Ops**: `kubectl logs -n statex-apps -l app=prompts-microservice -f` · `kubectl rollout restart deployment/prompts-microservice -n statex-apps` · `./scripts/deploy.sh`
