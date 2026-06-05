# External Integration Guide

This document describes how external microservices should integrate with the
leads-microservice to submit new lead requests.

## Base URLs

| Caller location | URL |
|----------------|-----|
| K8s in-cluster (recommended) | `http://leads-microservice.statex-apps.svc.cluster.local:4400` |
| Production public | `https://leads.alfares.cz` |

## Rate Limits

- Max 30 items per request
- Do not increase timeouts; check logs for delays

## Required Headers

- `Content-Type: application/json`
- Optional: `X-Request-Id` for traceability
- Optional: `X-Service-Name` to identify the caller

## Lead Submission Endpoint

`POST /api/leads/submit`

### Request Body

```json
{
  "sourceService": "statex",
  "sourceUrl": "https://alfares.cz/contact",
  "sourceLabel": "contact-form",
  "message": "I need a prototype and estimate",
  "contactMethods": [
    { "type": "email", "value": "client@example.com" },
    { "type": "whatsapp", "value": "+420777111222" },
    { "type": "telegram", "value": "@client_handle" },
    { "type": "phone", "value": "+420777111333" },
    { "type": "linkedin", "value": "https://linkedin.com/in/client" }
  ],
  "metadata": {
    "page": "https://alfares.cz/contact",
    "locale": "en"
  },
  "preferredChannel": "email",
  "fallbackChannels": ["whatsapp", "telegram"],
  "marketingConsent": true,
  "consentSource": "contact-form-v2",
  "consentCapturedAt": "2026-05-05T07:30:00.000Z"
}
```

### Response (Success)

```json
{
  "leadId": "uuid",
  "status": "new",
  "confirmationSent": true
}
```

### Response (Error)

```json
{
  "error": "validation_error",
  "message": "message is required"
}
```

## Lead Read Endpoints

### Get Lead by ID

`GET /api/leads/:id`

**Response**:

```json
{
  "id": "uuid",
  "status": "new",
  "sourceService": "statex",
  "sourceUrl": "https://alfares.cz/contact",
  "sourceLabel": "contact-form",
  "message": "I need a prototype and estimate",
  "createdAt": "2026-01-27T10:00:00.000Z",
  "contactMethods": [
    { "type": "email", "value": "client@example.com", "isPrimary": true }
  ]
}
```

### List Leads

`GET /api/leads?sourceService=statex&startDate=2026-01-01&endDate=2026-02-01&page=1&limit=30`

**Response**:

```json
{
  "items": [],
  "page": 1,
  "limit": 30,
  "total": 0
}
```

## Integration Notes

- Always send at least one `contactMethods` entry.
- `sourceService` is required for reporting and marketing workflows.
- Use existing shared microservices via env vars, not hardcoded URLs.
- All failures and retries should be logged through `LOGGING_SERVICE_URL`.

## Internal Preferences API (Trusted Services)

Used by trusted internal services like `marketing-microservice`.

- Required headers:
  - `x-internal-service-token: <INTERNAL_SERVICE_TOKEN>`
  - `x-service-name: <trusted-service-name>`

### Get Lead Preferences

`GET /api/leads/internal/:id/preferences`

### Update Lead Preferences

`PATCH /api/leads/internal/:id/preferences`

Body (all fields optional, nullable):

```json
{
  "preferredChannel": "telegram",
  "fallbackChannels": ["email"],
  "marketingConsent": true,
  "consentSource": "manual-support",
  "consentCapturedAt": "2026-05-05T07:30:00.000Z",
  "unsubscribedAt": null
}
```

### Unsubscribe Lead

`POST /api/leads/internal/:id/unsubscribe`
