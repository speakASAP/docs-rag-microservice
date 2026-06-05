# School Committee Platform

Mobile-first web platform for Czech primary school parent committees. Parents can contribute financially (QR bank payments), volunteer for tasks, and submit feedback. Committee gets transparency tools. No social feeds, no child accounts in MVP.

This repository is a documentation-first implementation template.

All product, architecture, API, legal, security, UX, database, backlog and implementation documentation is located in:

```text
/docs
```

The repository is designed so that a coding agent can start implementation from the documents without requiring additional product clarification.

## Setup

```bash
cp .env.example .env.local
# Fill in values — see docs/19-vault-secrets.md for guidance
npm install
```

Health checks:
- `GET /api/health/live` — liveness probe
- `GET /api/health/ready` — readiness probe (checks env var presence)

Run tests:
```bash
npm test             # Vitest unit tests
npm run type-check   # TypeScript strict mode check
```

## Existing infrastructure assumptions

The target environment already has:

- Kubernetes cluster
- Vault for secrets
- External authentication microservice
- External database microservice
- CI/CD pipeline
- Ingress/TLS infrastructure

This repository therefore documents:

- frontend and BFF responsibilities
- contracts with existing auth service
- contracts with existing DB service
- QR bank payment flow for Czechia
- GDPR and child-data handling
- implementation backlog
- agent-ready development tasks
