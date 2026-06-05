# TG-1.1 Notifications Validation Report

- decision: APPROVED
- date: 2026-05-05
- validator: phase-1-notifications-validator

## Checklist

| Criterion | Result | Evidence |
|---|---|---|
| Channel registry schema matches Sync A contract | pass | `notifications-microservice/src/notifications/entities/channel-registry.entity.ts` and `src/migrations/1746445200000-CreateChannelRegistryTable.ts` include required fields (`channelKey`, `type`, `provider`, `purposesAllowed`, `applicationsAllowed`, `isActive`, `fallbackChannelKey`, audit fields). |
| `/notifications/send` supports `channelKey` and `purpose` | pass | `notifications-microservice/src/notifications/dto/send-notification.dto.ts` defines additive `channelKey`, `purpose`, and sender override fields. |
| Missing `channelKey` path still works as before | pass | `notifications-microservice/src/notifications/channel-registry.service.ts` keeps legacy path and requires original `channel` only when `channelKey` is omitted. |
| App and purpose constraints are enforced | pass | `resolveSendPolicy` rejects disallowed `applicationsAllowed` and `purposesAllowed` combinations before send execution. |
| Admin UI can list and update channels | pass | `notifications-microservice/web/admin/index.html` now includes a Channel registry section, fetches `/admin/channels`, and updates via `PATCH /admin/channels/:channelKey` through the Save channel action. |
| Migration path from env defaults is documented and testable | pass | `notifications-microservice/README.md` includes migration notes with env/Vault bootstrap guidance. |
| Existing tests pass | pass | Executed: `npm test -- --runInBand` in `notifications-microservice` (1 suite, 7 tests, all passing). |
| Logs include operation outcome and duration | pass | Send flow logs include ISO timestamp and `duration_ms` (controller + service policy/send logs). |
| No hardcoded provider credentials | pass | Credential scan over `notifications-microservice/src` found no hardcoded API keys/secrets/tokens. |

## Gate Outcome

TG-1.1 is validated and approved for progression.
