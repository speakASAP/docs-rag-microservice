# System Architecture

## Target architecture

```text
Browser / PWA
   |
Next.js frontend
   |
BFF API layer
   |
-------------------------------------------------
| Auth Service | DB Service | Vault | Payments   |
| Notifications | Storage | Observability        |
-------------------------------------------------
   |
Kubernetes
```

## Main architectural decision

The application should not duplicate infrastructure already available.

Existing services remain source of truth:

- auth service owns users, login, tokens and password reset
- DB service owns persistence
- Vault owns secrets
- Kubernetes owns runtime
- payment integration owns payment confirmation

The application provides:

- user-facing UI
- admin UI
- BFF orchestration
- domain-specific API contracts
- validation
- authorization enforcement at API boundary
- audit event creation

## Frontend

Technology:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

Deployment:

- containerized
- Kubernetes deployment
- behind ingress
- TLS required

## BFF layer

Responsibilities:

- validate request payloads
- call auth service for user context
- call DB service for data operations
- call payment service/generator
- call notification service
- emit audit events
- normalize errors for frontend

Not responsible for:

- storing passwords
- storing payment card data
- direct database writes if DB service is mandatory
- long-running jobs without worker separation

## DB service

Expected responsibilities:

- CRUD operations
- transactions
- data validation
- persistence
- search/filter endpoints
- audit storage or audit event sink

## Auth service

Expected responsibilities:

- registration
- login
- logout
- token issuance
- email verification
- password reset
- role claims
- session management

## Vault

Secrets:

- payment webhook secrets
- DB service API token
- auth service client secret
- SMTP credentials
- signing keys
- storage credentials

## Storage

For files:

- task photos
- receipts
- feedback voice files
- completion proof

MVP may use existing object storage if available.

Requirements:

- private by default
- signed URLs
- file size limits
- MIME type validation
- malware scanning future

## Notifications

MVP:

- email notifications

Later:

- push notifications
- digest emails
- event reminders

## Payments

MVP:

- Czech QR bank transfer
- manual reconciliation
- optional CSV import

Later:

- bank API
- Czech payment gateway
- automatic webhook reconciliation

## Trust boundaries

### Public

- landing page
- public transparency report
- feedback form entry page

### Authenticated

- parent dashboard
- tasks
- profile
- payment history

### Privileged

- admin panel
- moderation
- user management
- payment confirmation
- expense publishing

## Main quality attributes

- simplicity
- auditability
- GDPR compliance
- modularity
- mobile performance
- low operational cost
- compatibility with existing infrastructure
