# Integration API Matrix (Sync A Freeze)

## Purpose

Freezes inter-service API contracts required for marketing campaign orchestration.

## Matrix

| Caller | Callee | Endpoint | Method | Contract Purpose | Owner |
|---|---|---|---|---|---|
| marketing | notifications | `/notifications/send` | POST | Outbound delivery via channel registry | notifications |
| marketing | notifications | `/notifications/history` | GET | Delivery outcome retrieval | notifications |
| marketing | auth | `/auth/internal/users/:id/preferences` | GET | Resolve auth user preference + consent | auth |
| marketing | auth | `/auth/internal/users/:id/preferences` | PATCH | Update consent/unsubscribe state | auth |
| marketing | auth | `/auth/internal/users/:id/unsubscribe` | POST | Set global unsubscribe marker for auth user | auth |
| marketing | leads | `/leads/internal/:id/preferences` | GET | Resolve lead preference + consent | leads |
| marketing | leads | `/leads/internal/:id/preferences` | PATCH | Update lead unsubscribe/consent fields | leads |
| marketing | leads | `/leads/internal/:id/unsubscribe` | POST | Set lead unsubscribe marker and disable marketing consent | leads |
| marketing | leads | `/internal/leads/search` | POST | Segment lead selection | leads |
| marketing | orders | `/internal/orders/search` | POST | Segment by order behavior | orders |

## Notifications Send Contract Slice

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string \| string[] | yes | Max 30 recipients. |
| `message` | string | yes | Channel payload. |
| `purpose` | string | yes | Includes `marketing`. |
| `channelKey` | string \| null | no | Optional explicit channel. |
| `metadata.campaignId` | string \| null | no | Traceability. |
| `metadata.deliveryId` | string \| null | no | Traceability. |

Fallback behavior: if `channelKey` is omitted, notifications uses backward-compatible default sender path.

## Cross-Service Error Contract

| Status | Meaning | Caller Action |
|---|---|---|
| `400` | Invalid payload/purpose/channel policy | Mark recipient failed, log `decisionReason`. |
| `401/403` | Missing or invalid service authorization | Stop chunk and surface operational alert. |
| `404` | Missing user/lead/channel | Skip recipient with explicit reason. |
| `409` | Idempotency or state conflict | Treat as non-fatal, deduplicate by key. |
| `429` | Rate or throttle limit | Retry later in background queue. |
| `5xx` | Downstream transient/system failure | Retry with backoff in background executor. |

## Logging Contract (Required Across Integrations)

| Field | Type | Required | Notes |
|---|---|---|---|
| `timestamp` | string (ISO 8601) | yes | Event time. |
| `duration_ms` | number | yes | Processing duration. |
| `decisionReason` | string | yes | Consent/channel/fallback reason. |
| `outcome` | enum(`sent`,`skipped`,`failed`,`retried`) | yes | Terminal/intermediate result. |
| `service` | string | yes | Source service name. |
| `operation` | string | yes | Operation id/name. |

## Validation Notes (Validator Agent)

- Confirm every cross-service field has a single owner service (auth/leads/notifications/marketing/orders).
- Confirm marketing uses service APIs or approved contracts with other services.
- Confirm outbound delivery path is only through notifications APIs.
