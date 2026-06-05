# System: payments-microservice

## Architecture

NestJS + PostgreSQL + TypeORM. Multi-gateway abstraction.

- Gateways: PayPal, Stripe, PayU, Fio Banka, ComGate
- Webhook endpoints per gateway
- Unified API: `POST /payments/create`, `POST /payments/refund`

### Pricing boundary

`payments-microservice` does not expose product list-price or price-suggestion endpoints.
All list pricing ownership is in `orders-microservice` (`/admin/pricing/*` and `/pricing/*`).

## Integrations

| Dependency | URL |
|-----------|-----|
| database-server | db-server-postgres:5432 |
| logging-microservice | logging-microservice:3367 |
| notifications-microservice | notifications-microservice:3368 |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
