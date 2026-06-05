# CLAUDE.md (marketing-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## marketing-microservice

**Purpose**: Centralized campaign and segmentation engine. Runs email/Telegram/WhatsApp campaigns with consent tracking and frequency caps.  
**Port**: 4600 · **Domain**: https://marketing.alfares.cz  
**Stack**: NestJS · PostgreSQL · Kubernetes (`statex-apps`)

### Key constraints
- Never send campaigns without owner approval — all sends require explicit trigger
- Unsubscribe requests must be honored within 24h — highest priority
- Enforce frequency caps per user per channel (stored in DB)
- All message delivery via notifications-microservice — never direct API calls to providers

### Consumers
flipflop-service, speakasap, beauty, statex.

**Ops**: `kubectl logs -n statex-apps -l app=marketing-microservice -f` · `kubectl rollout restart deployment/marketing-microservice -n statex-apps` · `./scripts/deploy.sh`
