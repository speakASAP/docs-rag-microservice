# TG-1.1 Notifications Implementation Output

- status: IMPLEMENTED_WITH_VALIDATION_PENDING
- date: 2026-05-05
- scope: `notifications-microservice`

## Delivered Items

| Requirement | Result | Evidence |
|---|---|---|
| DB entity/model for channel registry | pass | Added `src/notifications/entities/channel-registry.entity.ts` and wired it into TypeORM modules/data source. |
| Migration strategy for env-based defaults | pass | Added migration `src/migrations/1746445200000-CreateChannelRegistryTable.ts`; bootstrap strategy documented in `README.md` under Channel Registry Migration Notes. |
| `/notifications/send` extension with `channelKey`, `purpose`, sender overrides | pass | Extended `SendNotificationDto` and send policy resolution in `channel-registry.service.ts`; service now resolves `channelKey`, validates `applicationsAllowed` + `purposesAllowed`, and preserves fallback. |
| Backward compatibility when `channelKey` omitted | pass | `resolveSendPolicy` keeps legacy route and requires original `channel` only in this legacy path. |
| Admin UI/API support for channel list and update | pass | Added admin endpoints `GET /admin/channels`, `GET /admin/channels/:channelKey`, `PATCH /admin/channels/:channelKey`. |
| Logging includes ISO timestamp and `duration_ms` | pass | Request and policy resolution logs now include ISO `timestamp` and `duration_ms` fields in send path. |

## Notes

- No secret values were added to docs or code.
- Existing send callers remain supported without `channelKey`.
