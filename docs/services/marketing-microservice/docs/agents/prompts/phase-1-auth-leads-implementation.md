## Role
Auth and Leads Preferences Implementation Agent.

## Start Condition
Run only after Sync A is approved.

## Scope

- Extend auth model/API for user marketing preferences and consents.
- Extend leads model/API for lead contact preferences and consents.
- Keep changes additive and backward compatible.

## Inputs

- Sync A contracts
- `auth-microservice/README.md`
- `leads-microservice/README.md`

## Must Deliver

- Nullable preference/consent fields
- Secure read/update endpoints for trusted internal services
- Unsubscribe update path support
- Updated integration docs and examples

## Constraints

- Do not break existing auth/login flows.
- Do not duplicate identity ownership in leads.
- Keep audit logging for preference and consent changes.

