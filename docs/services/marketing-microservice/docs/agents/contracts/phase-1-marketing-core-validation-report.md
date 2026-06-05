# TG-1.3 Marketing Core Validation Report

- decision: APPROVED
- date: 2026-05-05
- validator: phase-1-marketing-core-validator

## Checklist

| Criterion | Result | Evidence |
|---|---|---|
| Scaffold follows current `shared/docs/CREATE_SERVICE.md` required outputs | pass | Repository contains `README.md`, `docs/`, `.env.example`, `k8s/` manifests, `scripts/deploy.sh`, and `nginx/nginx-api-routes.conf`. |
| Campaign and segment contracts match Sync A | pass | Runtime contracts in `src/types.ts` and CRUD payloads in `src/main.ts` now use Sync A field names/enums (`campaignId`, `segmentId`, `tenant`, `sourceTypes`, `rules`, contract status/purpose enums). |
| Executor batches to <=30 recipients per notifications call | pass | `src/executor.ts` uses `CHUNK_SIZE = 30` and chunked send path through `sendChunk(...)`. |
| Consent/unsubscribe checks are in send path and tested | pass | `src/executor.ts` enforces consent/unsubscribe checks before send; automated tests in `test/executor.test.ts` cover consent/unsubscribe, frequency cap, idempotency replay, and chunking behavior. |
| Logging captures timestamp, duration, decision reason, and outcome | pass | Structured logs in `src/executor.ts` include ISO timestamps and `duration_ms` for decision and chunk send outcomes (`recipient_decision`, `notification_chunk_send_*`, `campaign_execution_*`). |
| Lint/type/build checks pass | pass | Executed `npm run check` and `npm run build` in `marketing-microservice`; both succeeded. |
| Staging-like dry flow executes end-to-end decision path | pass | Local dry flow created segment+campaign, executed with idempotency key, produced `skipped` for unsubscribed contact and deterministic replay on repeated execute call. |

## Gate Outcome

TG-1.3 is validated and approved for progression.
