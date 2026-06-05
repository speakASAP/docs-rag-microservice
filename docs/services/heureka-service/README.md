# heureka-service

Heureka.cz/sk XML feed generation service.

**Domain**: https://heureka.alfares.cz  
**Stack**: NestJS · PostgreSQL · Kubernetes (`statex-apps`)  
**Port**: 3000 (ClusterIP)

## API

Base: `https://heureka.alfares.cz/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | Generate and return XML feed |
| GET | `/api/feed/download` | Download feed file |
| POST | `/api/feed/regenerate` | Manually regenerate feed |
| GET | `/api/products` | List products in feed |
| POST | `/api/products/:id/include` | Include product |
| DELETE | `/api/products/:id/exclude` | Exclude product |
| GET | `/api/settings` | Get feed settings |
| PUT | `/api/settings` | Update feed settings |

## Feed format

Heureka XML schema — validate with `curl https://heureka.alfares.cz/feed.xml | xmllint --noout -`

## Secrets

All secrets in Vault at `secret/prod/heureka-service` → ESO → K8s Secret `heureka-service-secret`.  
→ [VAULT.md](../shared/docs/VAULT.md)

## Architecture · Deployment · Ops

→ [SYSTEM.md](SYSTEM.md)

## Business rules · Constraints

→ [BUSINESS.md](BUSINESS.md)
