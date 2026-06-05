# TG-1.3 Marketing Core Implementation Output

- status: IMPLEMENTED_WITH_VALIDATION_PENDING
- date: 2026-05-05
- scope: `marketing-microservice`

## Delivered Items

| Requirement | Result | Evidence |
|---|---|---|
| Scaffold parity artifacts (docs/deploy/nginx routes) | pass | Added `scripts/deploy.sh`, `nginx/nginx-api-routes.conf`, `docs/API.md`, `docs/INTEGRATION.md`. |
| Segment CRUD | pass | Implemented `POST/GET/PUT/DELETE /segments` in `src/main.ts`. |
| Campaign CRUD | pass | Implemented `POST/GET/PUT/DELETE /campaigns` in `src/main.ts`. |
| Execution job with idempotency and chunking (`<=30`) | pass | Added `executeCampaign()` in `src/executor.ts` with `CHUNK_SIZE = 30` and idempotency key reuse. |
| Consent/unsubscribe + frequency cap checks before send | pass | Added decision checks in `evaluateRecipient()` (`consent_missing`, `unsubscribed`, `frequency_cap`). |
| Notifications-only outbound sending | pass | `sendChunk()` posts only to `${NOTIFICATION_SERVICE_URL}/notifications/send`. |
| Decision-path and outcome logging | pass | Structured decision/outcome logs via `src/logger.ts` and executor events with ISO timestamps and `duration_ms`. |

## Notes

- No direct outbound channel send was introduced.
- No timeout increase was introduced; processing remains chunked.
