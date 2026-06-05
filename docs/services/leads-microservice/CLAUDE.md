# CLAUDE.md (leads-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## leads-microservice

**Purpose**: Lead intake without registration. Contact form submissions → CRM + AI analysis.
**Domain**: https://leads.alfares.cz · **Port**: 4400
**Stack**: NestJS · PostgreSQL · Prisma · Kubernetes (`statex-apps`)
**Secrets**: Vault `secret/prod/leads-microservice` → K8s ExternalSecret

### Constraints
- GDPR: always store consent with lead
- No raw lead data export without owner approval
- No mass outreach without human review
- All notifications via notifications-microservice

### Consumers
statex · marketing-microservice

**Ops**: `curl https://leads.alfares.cz/health` · `kubectl logs -n statex-apps -l app=leads-microservice -f` · `./scripts/deploy.sh`
