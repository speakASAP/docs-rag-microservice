# Preferences and Consent Contract (Sync A Freeze)

## Purpose

Defines harmonized preference and consent structures for registered users (`auth-microservice`) and non-registered contacts (`leads-microservice`).

## Auth User Preferences and Consent (Owner: `auth-microservice`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | yes | Existing auth user id. |
| `preferredChannel` | enum(`email`,`telegram`,`whatsapp`,`none`) \| null | no | New field, nullable initially. |
| `fallbackChannels` | string[] \| null | no | New field, nullable initially. |
| `perApplicationPreferences` | object \| null | no | New field, nullable initially. |
| `perBrandPreferences` | object \| null | no | New field, nullable initially. |
| `marketingConsents` | object \| null | no | Purpose/brand consent map; nullable initially. |
| `transactionalOnly` | boolean \| null | no | Nullable initial rollout. |
| `unsubscribedAt` | string (ISO 8601) \| null | no | Global unsubscribe marker. |
| `updatedAt` | string (ISO 8601) | yes | Audit timestamp. |

## Lead Preferences and Consent (Owner: `leads-microservice`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `leadId` | string | yes | Existing lead id. |
| `email` | string \| null | no | Existing or optional contact channel. |
| `phone` | string \| null | no | Existing or optional contact channel. |
| `preferredChannel` | enum(`email`,`telegram`,`whatsapp`,`none`) \| null | no | New field, nullable initially. |
| `fallbackChannels` | string[] \| null | no | New field, nullable initially. |
| `marketingConsent` | boolean \| null | no | New field, nullable initially. |
| `consentSource` | string \| null | no | Form/page/reference metadata. |
| `consentCapturedAt` | string (ISO 8601) \| null | no | Capture timestamp. |
| `unsubscribedAt` | string (ISO 8601) \| null | no | Unsubscribe timestamp. |
| `updatedAt` | string (ISO 8601) | yes | Audit timestamp. |

## Unified Consent Decision Contract (for marketing execution)

| Field | Type | Required | Notes |
|---|---|---|---|
| `subjectRef` | string | yes | `auth:{userId}` or `lead:{leadId}`. |
| `subjectType` | enum(`auth`,`lead`) | yes | Source selector. |
| `purpose` | string | yes | Campaign purpose (e.g. `marketing`). |
| `isAllowed` | boolean | yes | Final legal/contractual decision. |
| `decisionReason` | string | yes | Explicit allow/deny rationale. |
| `checkedAt` | string (ISO 8601) | yes | Evaluation timestamp. |
| `duration_ms` | number | yes | Evaluation latency metric. |

## Ownership and Write Authority

- Marketing can read preferences/consents from auth/leads.
- Marketing can request updates through published auth/leads APIs only.
- Marketing cannot directly write auth or leads databases.

## Backward Compatibility

- All newly introduced auth/leads marketing fields are nullable/optional in initial version.
- Existing auth/leads consumers remain unaffected unless they explicitly adopt new fields.

## Validation Notes (Validator Agent)

- Confirm new auth/leads fields are nullable/optional at schema and DTO level.
- Confirm no marketing send path executes without consent check contract evaluation.
- Confirm unsubscribe updates propagate through owner API and are reflected in next campaign execution.
