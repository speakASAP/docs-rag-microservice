# TG-1.4 End-to-End Freeze Candidate

- date: 2026-05-05
- gate: TG-1.4 integration e2e
- candidate: `phase-1-e2e-evidence.md`

## Pass/Fail Matrix

| Criterion | Result | Evidence |
|---|---|---|
| One complete campaign flow from segment to send outcome | pass | `npm test -- --runInBand` execution produced `campaign_execution_started` -> recipient decisions -> `notification_chunk_send_*` -> `campaign_execution_completed`. |
| Segment resolution executed before sending | pass | Executor resolves recipients from segment rules before send chunking (`recipient_decision` events precede send events in runtime logs). |
| Consent checks enforced for auth and leads paths | pass | Runtime decisions include `recipientId=lead-1 decision=consent_missing` and auth path decisions for `auth-*` recipients. |
| Unsubscribe update/re-run behavior enforced | pass | Runtime decisions include `recipientId=auth-2 decision=unsubscribed` and second execution blocks previously sent recipient with `decision=frequency_cap`. |
| Notifications non-breaking path without `channelKey` remains valid | pass | TG-1.1 validation report confirms backward-compatible send behavior when `channelKey` is omitted; TG-1.4 uses same notifications endpoint contract. |
| Batch behavior is `<=30` per send call | pass | Observed chunk sizes: 30, 30, 6 in `notification_chunk_send_started` events; no chunk exceeds 30. |
| Logging includes ISO timestamp and `duration_ms` | pass | Runtime logs include ISO timestamps and `duration_ms` on chunk send completion; test output also includes `duration_ms` fields. |
| No timeout-increase workaround introduced | pass | Execution uses existing chunking design; no timeout values were increased for TG-1.4 evidence run. |
| Ownership boundaries preserved (auth/leads as identity owners, notifications as sender) | pass | Marketing execution path evaluates preferences and sends only via notifications endpoint; no direct outbound sending in marketing flow evidence. |

## TG-1.4 Decision

- decision: PASS

## Recommendation

Proceed to TG-1.4 validator step (`docs/agents/prompts/phase-1-integration-e2e-validator.md`).
