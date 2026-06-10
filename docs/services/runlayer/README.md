# runlayer (Project OS)

**Project OS** is the operating system for running multiple digital projects with **agent workers** and **human approvals**. This NestJS service implements that control plane in the Statex ecosystem: per-project coordinator cycles, worker pools, validation gates, goal/plan approval workflow, and an owner dashboard at `https://runlayer.alfares.cz`.

Product positioning and copy: [docs/POSITIONING.md](docs/POSITIONING.md).

Technically it persists businesses/projects/tasks/executions in PostgreSQL, uses Redis for leasing and queues, RabbitMQ for domain events, and routes all LLM work through **ai-microservice**. MCP-style capabilities (filesystem, postgres) are exposed to workers according to pool configuration.

## Stack

- NestJS 10, TypeScript 5, TypeORM 0.3 (PostgreSQL schema `runlayer`)
- Redis (`ioredis`), RabbitMQ (`amqplib`), JWT validation via **auth-microservice**
- Central logging and notifications URLs are configured for integration with **logging-microservice** and **notifications-microservice**

## Default port

**3390** (override with `PORT` in `.env`).

## Prerequisites

- PostgreSQL database (see `DB_*` in `.env.example`)
- Redis and RabbitMQ reachable at the URLs in `.env`
- On Docker: external network `nginx-network` (same pattern as other Statex services)
- For authenticated API calls: **auth-microservice** running and `AUTH_SERVICE_URL` set

## Configuration

Copy `.env.example` to `.env`, set secrets (especially `DB_PASSWORD`), and align service URLs with your environment. `.env` is the single source of truth; do not commit `.env`.

Key variables: `PORT`, `DB_*`, `REDIS_*`, `RABBITMQ_URL`, `AI_SERVICE_URL`, `LOGGING_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `TELEGRAM_CHAT_ID`, `EMAIL_TO`, `AUTH_SERVICE_URL`, `MCP_FILESYSTEM_ROOT`, `WORKER_MAX_CONCURRENT`, `LEASE_TTL_MS`.

## Database

Apply the SQL migration before first run (schema and tables):

```bash
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f migrations/001_initial_schema.sql
```

TypeORM is configured with `synchronize: false`; schema changes should go through migrations.

## Local development

```bash
npm install
npm run build
npm run start:dev
```

Health check (no auth):

```http
GET /health
```

## Docker

The image runs `node dist/main`; the TypeScript build emits `dist/main.js` from `src/` (`rootDir` in `tsconfig.json`).

```bash
docker compose build
docker compose up -d
```

Production-style deploy (includes git sync when `NODE_ENV=production`): `./scripts/deploy.sh`.

## API overview

All routes below except **`GET /health`** use **`Authorization: Bearer <jwt>`** validated by auth-microservice (`POST /auth/validate`).

| Area | Base path | Notes |
| ---- | --------- | ----- |
| Businesses | `POST/GET /businesses`, `GET /businesses/:id` | |
| Projects | `POST/GET /businesses/:businessId/projects`, `GET .../:projectId` | |
| Tasks | `GET /projects/:projectId/tasks`, `GET .../:taskId` | Optional `?status=` |
| Coordinator | `POST /projects/:projectId/cycle` | Triggers a project coordination cycle |
| Dashboard | `GET /dashboard` | Aggregated overview |

## Agent and model configuration

Runtime tuning and model tier mapping for coordinators, workers, and the validator are documented in **`AGENTS.md`** (coordinator-maintained section lists active agents when deployed).

## Tests

```bash
npm test
npm run test:e2e
```

## Further reading

- Product positioning: `docs/POSITIONING.md`
- Implementation plan and file map: `docs/superpowers/plans/2026-04-05-runlayer-mvp.md`
- Agent config: `AGENTS.md`
