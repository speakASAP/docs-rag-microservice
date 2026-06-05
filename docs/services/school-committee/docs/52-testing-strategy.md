# Testing Strategy

## Test pyramid

1. Unit tests
2. Integration tests
3. API contract tests
4. E2E tests
5. Manual acceptance tests

## Unit tests

Cover:

- validation schemas
- permission helpers
- QR payment payload generation
- date formatting
- status transitions

## Integration tests

Cover BFF with mocked upstream services:

- auth service
- DB service
- notification service
- payment adapter

## Contract tests

Validate:

- BFF request/response schemas
- DB service expectations
- auth token claims

## E2E tests

Recommended flows:

1. parent onboarding
2. QR payment generation
3. task claim
4. feedback submit
5. admin mark payment paid
6. admin create expense
7. public report visible

## Security tests

- parent cannot access another parent's payment history
- parent cannot mark task verified
- anonymous feedback does not reveal author
- admin-only exports blocked for parent
- task cannot be claimed twice

## Load tests

MVP light test:

- 100 concurrent parents
- 20 concurrent feedback submissions
- 20 concurrent task claims on same task

## Regression checklist

Before release:

- registration works
- dashboard loads
- QR code scans
- task claim atomic
- payment marking audited
- reports update
- language switching works
