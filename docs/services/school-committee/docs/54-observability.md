# Observability

## Logging

Use structured JSON logs.

Fields:

- timestamp
- level
- message
- request_id
- route
- method
- status_code
- duration_ms
- user_id_hash optional
- school_id
- error_code

## Metrics

Track:

- request count
- request latency
- error rate
- task claim conflicts
- QR payments generated
- payments confirmed
- feedback submitted
- admin actions
- notification failures

## Tracing

Propagate request ID to:

- auth service
- DB service
- notification service
- payment adapter

## Alerts

MVP alerts:

- high 5xx rate
- auth service unavailable
- DB service unavailable
- payment QR generation errors
- notification failures spike
- disk/storage issues
- pod crash loop

## Dashboards

Recommended dashboards:

- API health
- user activity
- payments
- tasks
- feedback
- admin actions
