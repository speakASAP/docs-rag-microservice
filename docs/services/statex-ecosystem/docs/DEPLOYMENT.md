# statex-ecosystem — deployment

## Standards

- [shared/docs/DEPLOY_STANDARD.md](../../shared/docs/DEPLOY_STANDARD.md) — `deploy.sh` structure, nginx-api-routes, registry behavior
- [shared/docs/CREATE_SERVICE.md](../../shared/docs/CREATE_SERVICE.md) — ecosystem conventions (`.env`, blue/green, nginx-network)
- [shared/README.md](../../shared/README.md) — port **47xx**: **4710** (blue), **4711** (green); container **3000**

## Ports

| Role | Host port | Variable | Container |
|------|-----------|----------|-----------|
| Blue | 4710 | `PORT` | 3000 (`CONTAINER_PORT`) |
| Green | 4711 | `PORT_GREEN` | 3000 |

Health: `GET /api/health` inside the container (and via nginx on the public domain).

## Production

1. Copy `.env.example` → `.env`; set `DOMAIN`, `NODE_ENV=production` if you use git pull in `deploy.sh`.
2. Ensure Docker network `nginx-network` exists (same as nginx-microservice).
3. From repo root: `./scripts/deploy.sh`

Register the service in nginx-microservice / service-registry as for other Alfares apps if not auto-created on first deploy.

## Local

- Dev server: `npm run dev` → <http://localhost:3000>
- Docker (no external network): `docker compose up --build` → <http://localhost:4710>
