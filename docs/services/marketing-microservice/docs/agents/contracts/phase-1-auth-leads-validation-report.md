# TG-1.2 Auth and Leads Validation Report

- decision: APPROVED
- date: 2026-05-05
- validator: phase-1-auth-leads-validator

## Checklist

| Criterion | Result | Evidence |
|---|---|---|
| New fields are optional/additive | pass | Auth user preference fields and leads preference fields are nullable and update endpoints patch only provided properties. |
| Ownership boundaries preserved (auth users vs leads contacts) | pass | Auth internal endpoints operate on `/auth/internal/users/:userId/*`; leads internal endpoints operate on `/leads/internal/:id/*`; no ownership crossover. |
| Consent and unsubscribe semantics are clear and enforceable | pass | Auth `unsubscribeUser` sets `transactionalOnly` and `unsubscribedAt`; leads `unsubscribeLead` sets `marketingConsent=false` and `unsubscribedAt`. |
| Service auth/rbac restrictions applied to update routes | pass | Both services protect internal preference and unsubscribe routes with `InternalServiceGuard` using token and trusted-service checks. |
| Existing API consumers remain functional | pass | Existing auth register/login flows and lead submit/list/get routes were not removed or behaviorally changed; new routes are additive internal APIs. |
| Logging for consent/preference updates exists | pass | Auth and leads include timestamped logs with `duration_ms` for internal preference read/update/unsubscribe operations. |
| Service tests pass | pass | `auth-microservice`: 2/2 suites pass. `leads-microservice`: 3/3 suites pass. |
| Lint and build checks pass | pass | `npm run lint` and `npm run build` succeeded in both services. |

## Issues

No blocking or non-blocking issues found.

## Gate Outcome

TG-1.2 is validated and approved for progression.
