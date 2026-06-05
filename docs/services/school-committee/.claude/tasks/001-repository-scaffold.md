# Task 001: Repository Scaffold

**Status:** done
**Epic:** EPIC-001 Repository Bootstrap
**Depends on:** none

## Context

The repo currently contains only docs and a minimal `.env.example`. Before any feature can be built, the Next.js application skeleton must exist with TypeScript strict mode, Tailwind, shadcn/ui, and the standard health endpoints the K8s deployment requires.

## Objective

Create a working Next.js 14+ application scaffold that passes TypeScript checks, has health endpoints, and matches the repository structure in `docs/50-repository-structure.md`.

## Relevant docs

- `docs/50-repository-structure.md` — target directory layout
- `docs/51-coding-standards.md` — TypeScript strict, naming rules
- `docs/18-kubernetes-deployment.md` — health endpoint requirements
- `docs/54-observability.md` — structured logging requirements

## Files likely touched

- `package.json` — Next.js, TypeScript, Tailwind, shadcn dependencies
- `tsconfig.json` — strict mode enabled
- `next.config.ts` — base config
- `tailwind.config.ts` — Tailwind setup
- `app/layout.tsx` — root layout
- `app/page.tsx` — placeholder landing page
- `app/api/health/live/route.ts` — liveness probe
- `app/api/health/ready/route.ts` — readiness probe
- `lib/logger.ts` — structured JSON logger
- `lib/request-id.ts` — request ID middleware helper
- `.env.example` — ensure all keys from `docs/11-existing-infrastructure-integration.md` present

## Implementation constraints

- TypeScript strict mode (`"strict": true` in tsconfig)
- No `any` types
- Health endpoints must return `{ status: "ok" }` with HTTP 200
- Readiness endpoint checks: AUTH_SERVICE_BASE_URL set, DB_SERVICE_BASE_URL set
- Logger must output JSON with fields: timestamp, level, message, request_id, route, status_code, duration_ms
- No secrets in any source file
- Follow MVP simplified structure from `docs/50-repository-structure.md`

## Acceptance criteria

- [ ] `npm run dev` starts without errors on port 4800
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `GET /api/health/live` returns `{ "status": "ok" }` HTTP 200
- [ ] `GET /api/health/ready` returns `{ "status": "ok" }` or `{ "status": "degraded", "checks": {...} }` depending on env var presence
- [ ] Tailwind and shadcn/ui available and produce no build errors
- [ ] `lib/logger.ts` exports a logger with `info`, `warn`, `error` methods producing JSON
- [ ] `.env.example` contains all keys from `docs/11-existing-infrastructure-integration.md`
- [ ] README.md updated with local dev instructions

## Tests required

- Unit test: `lib/logger.ts` output is valid JSON with required fields
- Unit test: `lib/request-id.ts` generates valid UUID v4
- Integration test: `GET /api/health/live` returns 200
- Integration test: `GET /api/health/ready` returns 200 or 503 based on env

## Do not

- Do not install or configure any auth library yet (task 002)
- Do not add database connection (task 003)
- Do not create any feature pages or components
- Do not use `any` type anywhere
- Do not add Stripe or any payment library
