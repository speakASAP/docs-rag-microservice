# leads-microservice

Lead intake without registration. Collects contact submissions; integrates with CRM and AI.

- **Domain**: https://leads.alfares.cz
- **Ports**: 4400 (blue) · 4401 (green)
- **Stack**: NestJS · PostgreSQL · Prisma
- **Namespace**: `statex-apps`

## Docs

| File | Purpose |
|------|---------|
| `BUSINESS.md` | Goals, constraints, SLA |
| `SYSTEM.md` | Architecture, endpoints, integrations |
| `CLAUDE.md` | Agent entry point, quick ops |
| `docs/EXTERNAL_INTEGRATION.md` | How consumers call this service |
| `k8s/` | Kubernetes manifests |

## Quick start

```bash
curl https://leads.alfares.cz/health
./scripts/deploy.sh
```
