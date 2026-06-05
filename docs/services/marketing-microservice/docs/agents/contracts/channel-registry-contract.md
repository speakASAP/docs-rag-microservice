# Channel Registry Contract (Sync A Freeze)

## Purpose

Defines the canonical channel registry model owned by `notifications-microservice` and consumed by `marketing-microservice` and other internal callers.

## Field Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `channelKey` | string | yes | Unique stable key, e.g. `flipflop_email_default`. |
| `type` | enum(`email`,`telegram`,`whatsapp`,`sms`) | yes | Delivery channel type. |
| `provider` | enum(`ses`,`sendgrid`,`telegram`,`meta_whatsapp`,`other`) | yes | Provider adapter in notifications. |
| `domain` | string \| null | no | Required for `email` channels; nullable for others. |
| `fromEmail` | string \| null | no | Sender email; nullable for non-email channels. |
| `fromName` | string \| null | no | Display sender name. |
| `replyToEmail` | string \| null | no | Optional reply-to for email channels. |
| `purposesAllowed` | string[] | yes | Must include `marketing` for campaign sends. |
| `applicationsAllowed` | string[] | yes | Allowed caller services, includes `marketing-microservice`. |
| `isActive` | boolean | yes | Inactive channel cannot be selected. |
| `fallbackChannelKey` | string \| null | no | Optional fallback route if primary is invalid/down. |
| `createdAt` | string (ISO 8601) | yes | Audit timestamp. |
| `updatedAt` | string (ISO 8601) | yes | Audit timestamp. |
| `createdBy` | string | yes | User/service identity. |
| `updatedBy` | string | yes | User/service identity. |

## Send API Resolution Contract

### Request (from marketing to notifications)

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string \| string[] | yes | Max 30 recipients per call. |
| `subject` | string | no | Used for email. |
| `message` | string | yes | Payload body or text fallback. |
| `purpose` | enum(`marketing`,`transactional`,`system`) | yes | Used for policy checks. |
| `channelKey` | string \| null | no | Explicit channel selection key. |
| `fromEmail` | string \| null | no | Optional override when allowed by policy. |
| `fromName` | string \| null | no | Optional override when allowed by policy. |
| `replyToEmail` | string \| null | no | Optional override for email. |
| `metadata` | object \| null | no | Campaign identifiers and trace fields. |

### Fallback When `channelKey` Is Omitted

`notifications-microservice` applies existing default behavior based on `.env` bootstrap defaults. This preserves backward compatibility for current callers.

## Ownership and Write Authority

- `notifications-microservice` owns registry data and validation logic.
- `marketing-microservice` can reference `channelKey` but cannot mutate registry records directly.
- Runtime sender secrets remain in `.env`/Vault-backed config; secrets are never embedded in contract docs.

## Backward Compatibility

- Existing `/notifications/send` callers without `channelKey` keep working through default resolution.
- New fields are additive and optional unless explicitly marked required in this contract.

## Validation Notes (Validator Agent)

- Confirm every `channelKey` used by marketing campaign defaults exists and is active.
- Confirm `applicationsAllowed` contains `marketing-microservice` for marketing channels.
- Reject any path that bypasses notifications as outbound sender.
- Confirm max recipients policy is documented and enforced as `<= 30`.
