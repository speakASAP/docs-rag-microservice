# bazos-service

Bazos.cz classifieds automation. → [BUSINESS.md](BUSINESS.md) for goals/SLA, [SYSTEM.md](SYSTEM.md) for stack/ports/deploy.

## Sub-services

| Container | Port | Purpose |
|-----------|------|---------|
| bazos | 3900 | Core ad management + scraping |
| api-gateway | 3901 | Auth proxy + routing |
| imports | 3902 | CSV import service |
| settings | 3903 | Account settings |
| gateway-proxy | 3904 | Nginx reverse proxy |
| frontend | 3905 | UI |

## Database

`bazos_db` · Prisma schema: `prisma/schema.prisma`

Tables: `bazos_accounts`, `bazos_ads`, `bazos_orders`

## Secrets

All secrets in Vault at `secret/prod/bazos-service` → K8s via ESO (`bazos-service-secret`). → [shared/docs/VAULT.md](../shared/docs/VAULT.md)

## API

Base: `https://bazos.alfares.cz/api` (dev: `http://localhost:3901/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Add account |
| GET | `/api/ads` | List ads |
| POST | `/api/ads` | Create ad |
| POST | `/api/ads/sync` | Sync from catalog |
| POST | `/api/ads/:id/renew` | Renew ad |
| GET | `/api/categories` | Category mappings |
