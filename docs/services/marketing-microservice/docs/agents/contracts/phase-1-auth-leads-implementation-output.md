# TG-1.2 Auth and Leads Implementation Output

- status: IMPLEMENTED_WITH_VALIDATION_PENDING
- date: 2026-05-05
- scope: `auth-microservice`, `leads-microservice`

## Delivered Items

| Requirement | Result | Evidence |
|---|---|---|
| Nullable/additive preference and consent fields for auth users | pass | `auth-microservice/src/users/entities/user.entity.ts` includes nullable `preferredChannel`, `fallbackChannels`, `perApplicationPreferences`, `perBrandPreferences`, `marketingConsents`, `transactionalOnly`, `unsubscribedAt`. |
| Nullable/additive preference and consent fields for leads | pass | `leads-microservice/src/leads/leads.service.ts` reads/writes nullable lead preference/consent fields (`preferredChannel`, `fallbackChannels`, `marketingConsent`, `consentSource`, `consentCapturedAt`, `unsubscribedAt`). |
| Secure internal read/update endpoints (auth) | pass | `auth-microservice/src/auth/auth.controller.ts` exposes `/auth/internal/users/:userId/preferences` (`GET`, `PATCH`) and `/unsubscribe` guarded by `InternalServiceGuard`. |
| Secure internal read/update endpoints (leads) | pass | `leads-microservice/src/leads/leads.controller.ts` exposes `/leads/internal/:id/preferences` (`GET`, `PATCH`) and `/unsubscribe` guarded by `InternalServiceGuard`. |
| Unsubscribe update path support | pass | `auth-microservice/src/auth/auth.service.ts` has `unsubscribeUser(...)`; `leads-microservice/src/leads/leads.service.ts` has `unsubscribeLead(...)` setting consent off and timestamp. |
| Audit logging for preference/consent changes | pass | Auth internal preference and unsubscribe service methods log ISO timestamp and `duration_ms`; leads controller logs preference read/update/unsubscribe with ISO timestamp and `duration_ms`. |
| Backward compatibility with existing flows | pass | Auth/login and lead submit/list/get routes remain unchanged while preference APIs are additive internal routes only. |

## Verification Executed

- `auth-microservice`: `npm test -- --runInBand`, `npm run lint`, `npm run build`
- `leads-microservice`: `npm test -- --runInBand`, `npm run lint`, `npm run build`

All commands passed.
