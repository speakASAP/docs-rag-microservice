# CLAUDE.md (statex)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## statex

**Purpose**: AI-powered business automation platform (alfares.cz) — rapid prototype generation, intelligent business analysis, EU/UAE market solutions.  
**Domain**: https://alfares.cz  
**Stack**: FastAPI (Python) · Next.js · PostgreSQL · Redis · RabbitMQ · MinIO · Elasticsearch

### Key constraints
- Never publish generated prototypes to production without human review
- Financial analysis outputs are advisory only — clearly label as such
- GDPR: user data handled per regulation
- All AI inference via ai-microservice — no direct LLM provider calls

### Key integrations
| Service | Usage |
|---------|-------|
| auth-microservice:3370 | User auth |
| ai-microservice:3380 | All AI features (prototypes, NLP, docs) |
| payments-microservice:3468 | Subscriptions |
| notifications-microservice:3368 | User alerts |

**Ops**: `kubectl logs -n statex-apps -l app=statex -f` · `kubectl rollout restart deployment/statex -n statex-apps` · `./scripts/deploy.sh`
