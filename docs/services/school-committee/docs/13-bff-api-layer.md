# BFF API Layer

## Purpose

The BFF protects frontend from internal service complexity.

It provides:

- stable frontend API
- request validation
- authorization checks
- orchestration
- error normalization
- audit event creation
- rate limiting

## Responsibilities

### Included

- validate input
- extract authenticated user
- check role permissions
- call DB service
- generate QR payment payload
- create audit events
- send notification requests
- map internal errors to frontend errors

### Excluded

- password handling
- storing secrets directly
- direct SQL if DB service owns data
- card payment processing
- large file processing in request path

## Example flow: claim task

```text
POST /api/tasks/{id}/claim
  -> validate auth
  -> check role parent/committee/admin
  -> call DB service atomic claim endpoint
  -> create audit event
  -> return updated task
```

## Required middleware

- request ID
- auth context
- rate limit
- CSRF protection for cookie-based sessions
- locale detection
- error handler
- audit context

## Rate limits

Suggested MVP:

| Endpoint | Limit |
|---|---:|
| register | handled by auth service |
| feedback submit | 5/hour/user or IP |
| QR payment generation | 20/hour/user |
| task comments | 60/hour/user |
| admin mutations | 300/hour/admin |

## Error mapping

| Internal condition | API code |
|---|---|
| invalid payload | VALIDATION_ERROR |
| not authenticated | UNAUTHENTICATED |
| role denied | FORBIDDEN |
| missing entity | NOT_FOUND |
| concurrent claim | CONFLICT |
| upstream timeout | UPSTREAM_TIMEOUT |
| unexpected | INTERNAL_ERROR |
