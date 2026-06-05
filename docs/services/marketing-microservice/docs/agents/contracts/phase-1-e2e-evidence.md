# TG-1.4 End-to-End Integration Evidence

- date: 2026-05-05
- executor: phase-1-integration-e2e-implementation
- scope: `marketing-microservice` integrated send path via `notifications-microservice`

## Campaign Test Scenario

One staging-like marketing campaign flow was executed from segment resolution through send outcome using existing runtime and tests.

- Segment source mix: `auth_users` + `leads`
- Campaign purpose: `marketing`
- Execution endpoint shape: `POST /campaigns/:id/execute` with idempotency key
- Notifications integration path: `POST ${NOTIFICATION_SERVICE_URL}/notifications/send`

## Request/Response Evidence for Integration Calls

Evidence captured from execution logs produced during `npm test -- --runInBand`:

- Outbound integration call start:
  - `event=notification_chunk_send_started`
  - `endpoint=http://notifications-microservice:3368/notifications/send`
  - sample chunk metadata: `chunkIndex=0`, `chunkSize=30`
- Outbound integration call completion:
  - `event=notification_chunk_send_completed`
  - sample completion metadata: `chunkIndex=0`, `chunkSize=30`, `sentCount=30`, `duration_ms=0`
- Execution completion:
  - `event=campaign_execution_completed`
  - sample aggregate metadata: `totalRecipients=68`, `totalSent=66`, `totalSkipped=2`, `totalFailed=0`

## Evidence of <=30 Batch Behavior

From the same run:

- `notification_chunk_send_started` with `chunkSize=30` (chunk 0)
- `notification_chunk_send_started` with `chunkSize=30` (chunk 1)
- `notification_chunk_send_started` with `chunkSize=6` (chunk 2)

All send calls stayed at or below the required `<=30` limit.

## Evidence of Consent and Unsubscribe Enforcement

From decision logs and tests:

- Lead consent enforcement (`leads` path):
  - `recipientId=lead-1`, `decision=consent_missing`
  - result contributes to `totalSkipped`
- Unsubscribe enforcement (`auth` path):
  - `recipientId=auth-2`, `decision=unsubscribed`
  - result contributes to `totalSkipped`
- Re-run behavior after first send:
  - first run: eligible auth recipient sent
  - subsequent run: same recipient blocked with `decision=frequency_cap`; unsubscribed user remains blocked

## Notifications Send with and without `channelKey`

- With `channelKey`: supported by marketing payload and notifications contract (`channelKey` is passed through when present).
- Without `channelKey`: covered by TG-1.1 approved compatibility evidence; notifications maintains legacy non-breaking send path when `channelKey` is omitted.

## Logging Contract Evidence (ISO timestamp and duration_ms)

Observed structured logs contain both fields:

- ISO timestamp examples:
  - `"timestamp":"2026-05-05T11:03:02.421Z"`
- Duration field examples:
  - `"duration_ms":0` in `notification_chunk_send_completed`
  - test harness summary includes `duration_ms` per subtest and suite

## Prerequisite Artifact Availability Note

TG-1.1, TG-1.2, and TG-1.3 validator approvals are present in `marketing-microservice/docs/agents/contracts`.
