## Role
Notifications Channel Registry Implementation Agent.

## Start Condition
Run only after Sync A is approved.

## Scope

- Implement database-backed channel registry in notifications service.
- Extend `POST /notifications/send` with `channelKey`, `purpose`, optional sender overrides.
- Preserve old behavior when `channelKey` is omitted.
- Provide minimal admin UI pages for channel CRUD and audit visibility.

## Inputs

- Sync A approved contracts under `marketing-microservice/docs/agents/contracts/`
- `notifications-microservice/README.md`
- Existing notifications API/DTO/service and admin UI files

## Must Deliver

- DB entity/model for channel registry
- Migration/seed strategy for existing env-based defaults
- API DTO/service/controller updates
- Admin UI: list/create/edit channels
- Docs update for contract and migration notes

## Hard Constraints

- No secrets in DB docs; reference env key names where needed.
- No breaking changes for current callers.
- Keep logging with timestamp and `duration_ms`.
- Enforce application and purpose validation.

