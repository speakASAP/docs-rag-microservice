# Context: Architecture

Source of truth: `docs/10-system-architecture.md`, `docs/11-existing-infrastructure-integration.md`, `docs/59-risks-and-decisions.md`

## Pattern

```
Browser/PWA → Next.js (frontend + BFF in one container for MVP)
                 ↓           ↓            ↓             ↓
           auth-svc    db-service   notifications   QR generator (internal)
```

## Mode A (MVP)

One Next.js container handles:
- Server-side rendered pages
- API routes acting as BFF
- Server actions

No separate BFF container in MVP. Split only if internal standards require it.

## Key ADRs

| ADR | Decision |
|-----|----------|
| ADR-001 | No internal auth — use auth-microservice |
| ADR-002 | No direct DB — use DB service API |
| ADR-003 | No `.env` secrets in prod — Vault only |
| ADR-004 | QR bank payments (no Stripe) |
| ADR-005 | No child accounts in MVP |
| ADR-006 | All docs in `/docs` |

## Trust zones

- **Public:** landing, public report, feedback QR form
- **Authenticated:** dashboard, tasks, payments, profile
- **Privileged:** admin panel, moderation, payment confirmation, audit log

## BFF responsibilities

validate → authenticate → authorize → call-upstream → audit → respond

BFF must never trust frontend-provided role. Extract from verified JWT or query DB service.
