# Environment Files Standard

## Secret source by deployment mode

| Mode | Secret source | How to access |
|------|--------------|--------------|
| **K8s (production)** | Vault → ESO → K8s Secret | `kubectl get secret <svc>-secret -n statex-apps` |
| Kubernetes | Vault → script → `.env` | `./shared/scripts/vault-env-gen.sh <svc> prod` |
| Local dev | Vault → script → `.env` | `./shared/scripts/vault-env-gen.sh <svc> prod` |

> **Never hand-write production secrets into `.env`.** K8s pods do NOT read `.env`.

## Rules

1. `.env` is for **local dev and Kubernetes only** — never commit it.
2. `.env.example` has the same **keys**, empty values — never include secrets.
3. Back up `.env` before changes: `cp .env .env.backup.$(date +%Y%m%d_%H%M%S)`
4. Keep section banners and canonical variable names for sync scripts.

## Canonical variable names

| Variable | Purpose |
|----------|---------|
| `AUTH_SERVICE_URL` | `http://auth-microservice:3370` |
| `LOGGING_SERVICE_URL` | `http://logging-microservice:3367` |
| `LOGGING_SERVICE_API_PATH` | Optional path suffix (e.g. `/api/logs`) |
| `NOTIFICATION_SERVICE_URL` | `http://notifications-microservice:3368` |
| `PAYMENT_SERVICE_URL` | Payments microservice |
| `PAYMENT_API_KEY` | Secret — empty in `.env.example` |
| `AI_SERVICE_URL` | `http://ai-microservice:3380` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Shared PostgreSQL — values from [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Shared Redis — values from [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md) |
| `JWT_SECRET` | Must match auth-microservice — empty in `.env.example` |

## Section order

Identity → Ports → Shared URLs → DB/Redis Kubernetes DNS → Secrets → App-specific

→ Archetype examples (NestJS, Next.js, multi-container): see [CREATE_SERVICE.md](./CREATE_SERVICE.md)
