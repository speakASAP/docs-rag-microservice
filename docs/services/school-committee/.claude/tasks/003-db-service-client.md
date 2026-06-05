# Task 003: Database Layer (ORM)

**Status:** ready
**Epic:** EPIC-001 Repository Bootstrap
**Depends on:** 001

## Context

The platform connects directly to the shared PostgreSQL instance via Kubernetes service DNS (see [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md)) using an ORM (Prisma recommended). There is no intermediate DB microservice API.

Database credentials come from Vault via ESO: `DB_SERVICE_TOKEN` maps to the DB password, with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` set via ConfigMap.

## Objective

Set up Prisma (or TypeORM) with schema, migrations, and typed repository helpers for all entities in `docs/30-domain-model.md`. The database layer must be usable from Next.js server components and API routes.

## Relevant docs

- `docs/30-domain-model.md` — entity definitions, relations, field types
- `docs/32-api-rest-contracts.md` — query shapes expected by API routes
- `docs/35-error-model.md` — error codes for conflict/not-found cases
- `docs/52-testing-strategy.md` — integration test approach

## Files likely touched

- `prisma/schema.prisma` — data model (or `src/db/entities/` for TypeORM)
- `lib/db/client.ts` — singleton Prisma client with connection pooling
- `lib/db/profiles.ts` — profile CRUD
- `lib/db/tasks.ts` — task CRUD + atomic claim (SELECT FOR UPDATE)
- `lib/db/payments.ts` — payment intent create/update/list
- `lib/db/feedback.ts` — feedback create/list/moderate
- `lib/db/audit.ts` — audit log write
- `lib/db/classes.ts` — class list
- `lib/db/expenses.ts` — expense CRUD
- `lib/db/reports.ts` — public report aggregation query
- `types/db.ts` — shared TS types matching domain model

## Environment variables

From **ConfigMap** (non-secret):
```
DB_HOST=db-server-postgres
DB_PORT=5432
DB_USER=dbadmin
DB_NAME=school_committee_platform
```

From **K8s Secret** (Vault → ESO):
```
DB_SERVICE_TOKEN   ← this is the DB password
```

`DATABASE_URL` should be constructed at runtime:
```ts
const url = `postgresql://${DB_USER}:${DB_SERVICE_TOKEN}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
```

## Implementation constraints

- Use Prisma unless project already has TypeORM set up — do not mix ORMs
- Singleton client pattern to avoid connection exhaustion in Next.js dev mode (global cache)
- Atomic task claim must use a transaction with `SELECT FOR UPDATE` to prevent double-claim
- Audit writes: every mutation that changes user-visible state must insert an `audit_events` row in the same transaction
- All list queries must accept `limit` (default 20, max 100) and `cursor` (offset or keyset)
- No raw SQL except for the atomic claim transaction — use ORM query builder elsewhere
- Schema migrations run via `prisma migrate deploy` in deploy.sh before `kubectl rollout`

## Acceptance criteria

- [ ] Prisma schema covers all entities from `docs/30-domain-model.md`
- [ ] `lib/db/client.ts` exports singleton client, works in both Next.js server context and test context
- [ ] `tasks.claimTask(taskId, userId)` uses transaction + `SELECT FOR UPDATE`, throws `CONFLICT/TASK_ALREADY_CLAIMED` if already taken
- [ ] `audit.writeEvent(event)` inserts row into `audit_events` table
- [ ] Pagination: list helpers accept and apply `limit`/`cursor` params
- [ ] `prisma migrate status` shows all migrations applied in a clean DB
- [ ] No TypeScript errors under `strict: true`

## Tests required

- Unit test: singleton client returns same instance across imports
- Unit test: `buildDatabaseUrl()` constructs URL from env vars correctly
- Integration test: `tasks.claimTask` on already-claimed task throws CONFLICT
- Integration test: `audit.writeEvent` persists row with correct fields
- Integration test: list helpers respect `limit` and return correct `nextCursor`

## Do not

- Do not call an external DB HTTP service — connect directly via ORM
- Do not use `DATABASE_URL` as a hardcoded literal — construct from individual env vars
- Do not cache query results without an explicit TTL and invalidation strategy
- Do not skip audit events for mutations — every state change must be traceable
- Do not run migrations in application startup code — migrations run in deploy.sh only
