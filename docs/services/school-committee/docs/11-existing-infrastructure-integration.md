# Existing Infrastructure Integration

## Assumptions

The platform runs in an existing infrastructure with:

- Kubernetes
- Vault
- DB microservice
- Auth microservice
- internal service discovery
- ingress
- monitoring stack

## Required configuration

Environment variables:

```text
NODE_ENV
APP_BASE_URL
AUTH_SERVICE_BASE_URL
AUTH_SERVICE_AUDIENCE
DB_SERVICE_BASE_URL
DB_SERVICE_API_VERSION
PAYMENT_ACCOUNT_IBAN
PAYMENT_ACCOUNT_PREFIX
PAYMENT_ACCOUNT_BANK_CODE
PAYMENT_QR_MESSAGE_PREFIX
VAULT_SECRET_PATH
NOTIFICATION_SERVICE_BASE_URL
PUBLIC_REPORT_CACHE_TTL_SECONDS
```

Secrets must come from Vault, not `.env` in production.

## Service communication

Recommended:

```text
frontend/bff -> auth-service
frontend/bff -> db-service
frontend/bff -> notification-service
frontend/bff -> payment-adapter
```

## Network policies

Minimum policies:

- frontend can talk to BFF
- BFF can talk to auth service
- BFF can talk to DB service
- BFF can talk to notification service
- BFF can read mounted secrets
- public internet cannot access internal services directly

## Deployment modes

### Mode A: Next.js monolith

One container:

- frontend pages
- API routes
- server actions

Good for MVP.

### Mode B: Split frontend and BFF

Two containers:

- frontend static/SSR
- BFF API service

Better for scale and stricter isolation.

## Recommended MVP mode

Mode A unless internal standards require split services.

## Internal auth validation

BFF must validate:

- token signature or introspection
- token expiry
- audience
- role
- tenant_id
- school_id

Never trust frontend-provided role.

## DB service integration

BFF sends authenticated user context to DB service:

```http
X-User-Id: uuid
X-User-Role: parent
X-Tenant-Id: uuid
X-School-Id: uuid
X-Request-Id: uuid
```

DB service should enforce authorization or at minimum verify caller service identity.

## Request tracing

All requests should carry:

- request_id
- user_id if authenticated
- tenant_id
- school_id
- action name
