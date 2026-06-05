# CLAUDE.md (statex-ecosystem)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## statex-ecosystem

**Purpose**: Ecosystem dashboard and service directory — unified portal for the Statex microservices platform.  
**Port**: 4710 · **Domain**: https://statex-ecosystem.alfares.cz  
**Stack**: Next.js · Kubernetes (`statex-apps`)

### Key constraints
- This is NOT the standard Next.js — APIs, conventions, and file structure may differ from training data. Read guides in `node_modules/next/dist/docs/` before writing any code.
- Never commit or push; follow workspace `.cursor/rules/no-git-commit.mdc`

### Secrets
All secrets in Vault at `secret/prod/statex-ecosystem` → ESO → K8s Secret `statex-ecosystem-secret`.

**Ops**: `kubectl logs -n statex-apps -l app=statex-ecosystem -f` · `kubectl rollout restart deployment/statex-ecosystem -n statex-apps` · `./scripts/deploy.sh`
