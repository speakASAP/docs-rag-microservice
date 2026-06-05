# Error Model

## Standard error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "fields": {
      "amountCzk": "Must be greater than zero"
    },
    "requestId": "req_123"
  }
}
```

## Error codes

| Code | HTTP | Meaning |
|---|---:|---|
| VALIDATION_ERROR | 400 | Payload is invalid |
| UNAUTHENTICATED | 401 | Missing or invalid auth |
| EMAIL_NOT_VERIFIED | 403 | Email verification required |
| FORBIDDEN | 403 | Role does not allow action |
| NOT_FOUND | 404 | Entity does not exist |
| CONFLICT | 409 | Concurrent or duplicate operation |
| TASK_ALREADY_CLAIMED | 409 | Task was claimed by someone else |
| PAYMENT_ALREADY_CONFIRMED | 409 | Paid payment cannot be changed |
| RATE_LIMITED | 429 | Too many requests |
| UPSTREAM_TIMEOUT | 504 | Internal service timeout |
| INTERNAL_ERROR | 500 | Unexpected error |

## Frontend behavior

- show user-friendly message
- include request ID in support details
- for validation, show field-level errors
- for conflict, refresh affected resource
- for auth errors, redirect to login
