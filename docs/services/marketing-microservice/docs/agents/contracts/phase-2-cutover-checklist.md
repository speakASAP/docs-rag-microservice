# Phase 2 Cutover Checklist (Sync E)

## Pre-Deploy Checks

- Confirm prerequisite approvals:
  - `docs/agents/contracts/phase-1-validation-report.md` = `APPROVED`
  - `docs/agents/contracts/phase-2-observability-validation-report.md` = `APPROVED`
- Confirm docs alignment:
  - marketing ownership boundaries and consent flow in `marketing-microservice/README.md`
  - notifications `channelKey`/`purpose` + fallback behavior in `notifications-microservice/README.md`
  - auth ownership boundaries in `auth-microservice/README.md`
  - flipflop SES migration statements in:
    - `flipflop-service/README.md`
    - `flipflop-service/docs/ENV_VARIABLES.md`
    - `flipflop-service/docs/EXTERNAL_MICROSERVICES_INTEGRATION.md`
- Confirm environment keys exist (keys only in examples):
  - `NOTIFICATION_SERVICE_URL`
  - `LOGGING_SERVICE_URL`
  - `CAMPAIGN_MAX_SEND_PER_RUN`
- Confirm no timeout increases were introduced for campaign execution flow.

## Rollout Checks

- Deploy services using existing deploy scripts (no manual nginx edits).
- Run one staging-like campaign execution:
  - verify `recipient_decision` logs include `preferredChannel`, `effectiveChannel`, `channelResolutionReason`
  - verify `campaign_execution_completed` includes `statusCounts` and `reasonCounts`
  - verify chunk sizes remain `<=30`
- Verify send path remains via notifications endpoint only:
  - `POST ${NOTIFICATION_SERVICE_URL}/notifications/send`

## Rollback Triggers

- Missing or malformed decision taxonomy in execution logs.
- Chunk size above `30` on any notification send call.
- Unexpected direct outbound sending path outside notifications-microservice.
- Consent/unsubscribe decisions not enforced (`consent_missing`, `unsubscribed`, `frequency_cap` absent where expected).
- Breaking behavior for callers that omit `channelKey`.

## Post-Deploy Validation Checks

- Re-run campaign execution tests in service scope (`npm test -- --runInBand`).
- Validate one flow with `channelKey` and one without `channelKey` (legacy fallback path).
- Confirm guardrail behavior:
  - `campaign_guardrail_triggered` is emitted when `CAMPAIGN_MAX_SEND_PER_RUN` is exceeded.
- Confirm flipflop notification docs consistently reference AWS SES as active identity path.
