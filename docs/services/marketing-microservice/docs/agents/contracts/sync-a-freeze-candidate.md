# Sync A Freeze Candidate (Marketing Scope)

## Included Deliverables

1. `channel-registry-contract.md`
2. `marketing-campaign-contract.md`
3. `preferences-consent-contract.md`
4. `integration-api-matrix.md`

## Consistency Assertions

- Notifications is the sole outbound sender service.
- Auth owns registered-user marketing preference and consent data.
- Leads owns non-registered contact preference and consent data.
- Marketing owns campaigns, segments, execution state, and delivery decision logs.
- All newly introduced auth/leads preference fields are nullable/optional in this initial contract version.
- Recipient send batches are capped at 30 per send call.
- Timeout strategy is chunking/background execution; no timeout increase policy is allowed.
- Logging contract requires ISO timestamp, `duration_ms`, decision reason, and outcome.
- `POST /notifications/send` defines explicit non-breaking fallback when `channelKey` is omitted.

## Backward Compatibility Notes

- Additive API strategy: new fields are optional unless explicitly required.
- Existing notifications callers remain valid without `channelKey`.
- Existing auth/leads consumers remain valid because new preference/consent fields are nullable.

## Validator Readiness Checklist

| Check | Status |
|---|---|
| All 5 required Sync A docs exist | pass |
| Field-level schema tables present in each contract doc | pass |
| Ownership and write authority sections present | pass |
| Backward compatibility sections present | pass |
| Validation notes for validator agent present | pass |
| No placeholder markers remain | pass |
| Consent logic covers both auth users and leads | pass |
| `channelKey` omission fallback documented | pass |

## Freeze Decision

`freeze_candidate_status`: ready-for-validator-review
