# Marketing Campaign Contract (Sync A Freeze)

## Purpose

Defines campaign, segment, execution, and delivery contracts owned by `marketing-microservice`.

## Campaign Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `campaignId` | string (uuid) | yes | Primary identifier. |
| `tenant` | string | yes | App/brand owner. |
| `name` | string | yes | Human label. |
| `description` | string \| null | no | Optional details. |
| `purpose` | enum(`marketing`,`retention`,`transactional-not-marketing`) | yes | Consent rules depend on purpose. |
| `segmentId` | string | yes | Segment contract reference. |
| `primaryChannel` | enum(`email`,`telegram`,`whatsapp`) | yes | Initial intended channel. |
| `fallbackChannels` | string[] | no | Ordered allowed channel fallback set. |
| `channelKey` | string \| null | no | Explicit notifications channel selection. |
| `templateRef` | string | yes | Template key or id. |
| `scheduleAt` | string (ISO 8601) \| null | no | Null means immediate queued run. |
| `throttlePerMinute` | number \| null | no | Optional throttling parameter. |
| `status` | enum(`draft`,`scheduled`,`running`,`paused`,`completed`,`failed`,`archived`) | yes | Lifecycle state. |
| `createdAt` | string (ISO 8601) | yes | Audit timestamp. |
| `updatedAt` | string (ISO 8601) | yes | Audit timestamp. |

## Segment Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `segmentId` | string (uuid) | yes | Primary identifier. |
| `name` | string | yes | Segment name. |
| `sourceTypes` | enum[] | yes | Contains one or more of `auth_users`, `leads`, `orders`. |
| `rules` | object | yes | Predicate tree (AND/OR filters). |
| `isDynamic` | boolean | yes | Recomputed if true. |
| `estimatedCount` | number \| null | no | Optional planning metric. |

## Delivery Job and Recipient Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `deliveryId` | string (uuid) | yes | Send attempt id. |
| `campaignId` | string | yes | Parent campaign. |
| `recipientRef` | string | yes | `auth:{userId}` or `lead:{leadId}`. |
| `recipientSource` | enum(`auth`,`leads`) | yes | Consent source selector. |
| `recipientAddress` | string | yes | Email/phone/chat address. |
| `requestedChannel` | string | yes | Campaign-selected channel. |
| `effectiveChannel` | string | yes | Final channel after preference/consent checks. |
| `status` | enum(`queued`,`skipped`,`sent`,`failed`) | yes | Outcome. |
| `decisionReason` | string | yes | Why skipped/selected/fallback happened. |
| `duration_ms` | number | yes | Processing latency per recipient/chunk. |
| `processedAt` | string (ISO 8601) | yes | Processing timestamp. |

## Execution Rules

- All sends go through `notifications-microservice` only.
- Max recipients per send call: `30`.
- Long runs must use chunking/background execution; timeout increase is prohibited.
- Consent checks are mandatory before each recipient send decision.

## Ownership and Write Authority

- `marketing-microservice` owns campaigns, segments, execution jobs, and delivery outcomes.
- `auth-microservice` owns registered-user preference/consent source fields.
- `leads-microservice` owns lead preference/consent source fields.
- `notifications-microservice` owns final provider send execution and channel registry.

## Backward Compatibility

- New campaign fields are additive and optional where possible.
- Existing consumers can ignore unknown fields safely.

## Validation Notes (Validator Agent)

- Validate each delivery has exactly one `recipientSource` owner (`auth` or `leads`).
- Validate all send requests respect `<= 30` recipient chunking.
- Validate logging payload includes ISO timestamp, `duration_ms`, decision reason, and outcome.
