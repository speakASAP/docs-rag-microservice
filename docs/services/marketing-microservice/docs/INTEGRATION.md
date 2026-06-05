# Integration Notes

## Upstream dependencies

- `AUTH_SERVICE_URL` - registered users and preferences (next phase integration).
- `LEADS_SERVICE_URL` - lead contacts and consent (next phase integration).
- `NOTIFICATION_SERVICE_URL` - required, used as the only outbound channel.
- `LOGGING_SERVICE_URL` - centralized logging sink (JSON logs with timestamp and duration_ms).

## Current Phase 1 behavior

- Segment filters are stored and evaluated in service runtime.
- Contact source is a local stub in `src/store.ts` pending cross-service connectors.
- All outbound sends remain delegated to notifications microservice.
- `channelKey` is optional in outbound payloads; if omitted, notifications uses its backward-compatible default sender resolution.

## Ownership Boundaries (Cutover Critical)

- `marketing-microservice` owns campaign orchestration, recipient decisions, and execution outcomes.
- `auth-microservice` owns registered-user preference and consent data (read/update only through auth APIs).
- `leads-microservice` owns lead preference and consent data (read/update only through leads APIs).
- `notifications-microservice` owns channel registry and final provider dispatch.
- No direct database writes are allowed across these service boundaries.

## Phase 2 observability and spam-risk fields

- `recipient_decision` logs include:
  - `decision` (`eligible`, `consent_missing`, `unsubscribed`, `frequency_cap`)
  - `preferredChannel`
  - `effectiveChannel`
  - `channelResolutionReason` (`preferred_channel_applied`, `campaign_primary_in_fallback`, `preferred_channel_mismatch_kept`, `transactional_primary_override`)
- `campaign_guardrail_triggered` logs fire when approved recipients exceed `CAMPAIGN_MAX_SEND_PER_RUN`.
- `campaign_execution_completed` logs include:
  - `statusCounts` map (`sent`, `skipped`, `failed`)
  - `reasonCounts` map keyed by `decisionReason`.

Operators should use these fields to identify suppression causes, detect resend pressure, and validate channel resolution decisions without increasing timeouts.
