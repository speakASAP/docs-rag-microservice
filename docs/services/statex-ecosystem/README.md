# statex-ecosystem

Next.js catalog of Statex applications and microservices with curated outbound links. Deployed with **nginx-microservice** blue/green like other Statex sites.

**Production URL:** <https://statex-ecosystem.alfares.cz>

## Ports (47xx range)

| Deployment | Host port | Env variable | Container port |
|------------|-----------|--------------|------------------|
| Blue | **4710** | `PORT` | `CONTAINER_PORT` (default **3000**) |
| Green | **4711** | `PORT_GREEN` | **3000** |

Documented in [shared/README.md](../shared/README.md) (Port Configuration Reference). **4710–4711** follow **rehtani** (4700–4701) in the same **47xx** static/catalog block.

## Configuration

- Copy [`.env.example`](.env.example) to `.env` (never commit `.env`).
- Required keys: `DOMAIN`, `SERVICE_NAME`, `NGINX_NETWORK_NAME`, `PORT`, `PORT_GREEN`, `CONTAINER_PORT`.
- Template and canonical env names: [shared/docs/ENV_FILE_STANDARD.md](../shared/docs/ENV_FILE_STANDARD.md) (archetype B).
- See [shared/docs/DEPLOY_STANDARD.md](../shared/docs/DEPLOY_STANDARD.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Development

```bash
npm install
npm run dev
```

- App: <http://localhost:3000>
- Health: <http://localhost:3000/api/health>

## Build

```bash
npm run build
npm start
```

## Docker

**Production (blue/green, requires `nginx-network`):**

```bash
docker compose -f docker-compose.blue.yml config --quiet
docker compose -f docker-compose.green.yml config --quiet
./scripts/deploy.sh
```

**Local smoke test** (default bridge network):

```bash
docker compose up --build
```

→ <http://localhost:4710> (host `PORT` → container `3000`).

## Deploy script

From repository root:

```bash
chmod +x scripts/deploy.sh   # once
./scripts/deploy.sh
```

Uses `nginx-microservice/scripts/blue-green/deploy-smart.sh`. Nginx route list: [`nginx/nginx-api-routes.conf`](nginx/nginx-api-routes.conf) (empty on purpose — full-URI proxy for Next.js assets; see [rehtani/nginx/nginx-api-routes.conf](../rehtani/nginx/nginx-api-routes.conf)).

## Data

Service names and metadata are curated in `src/data/ecosystem.ts`.

Public URLs are resolved at runtime in this order:

1. `nginx-microservice/service-registry` JSON entries (configurable with `NGINX_SERVICE_REGISTRY_PATH`)
2. `.env` overrides by slug pattern: `<SLUG_UPPERCASE_WITH_UNDERSCORES>_PUBLIC_URL` (example: `AGENTIC_EMAIL_PROCESSING_SYSTEM_PUBLIC_URL`)

When you add a service in `shared/README.md` or `shared/ECOSYSTEM_MAP.md`, update `src/data/ecosystem.ts`. Do not hardcode public URLs there.

**business-orchestrator** is listed as **Coming soon** with planned URL `https://orchestrator.alfares.cz`.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, `output: "standalone"` for Docker.
