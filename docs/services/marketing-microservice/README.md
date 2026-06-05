# Marketing Microservice

Centralized campaign and segmentation engine for the Statex ecosystem. Enables any application (flipflop-service, speakasap, speakasap-portal, beauty, etc.) to run marketing campaigns (email, Telegram, WhatsApp) without reimplementing notification logic. All outbound communication goes through **notifications-microservice**; contact data and channel preferences come from **auth-microservice** (registered users) and **leads-microservice** (leads who may not be registered).

## Purpose

- **Segments** – Define audiences from auth-microservice users, leads-microservice leads, and order/catalog data (e.g. “bought product X”, “never purchased”, “opted-in leads”).
- **Campaigns** – Create, schedule, and run campaigns with templates, channel strategy (email/Telegram/WhatsApp), throttling, and purpose (marketing, retention, transactional).
- **Consent & compliance** – Respect per-user and per-lead marketing consent; support unsubscribe flows and explicit permission (registration checkbox, account options, site rules/legal).
- **Delivery** – Batch recipients (max 30 per request), call notifications-microservice for each send, track outcomes and respect frequency caps.

Marketing-microservice does **not** send email or messages directly; it orchestrates campaigns and delegates delivery to notifications-microservice.

## Features (Planned)

- Segment definitions (static lists, rule-based, multi-source: auth, leads, orders)
- Campaign CRUD and scheduling (one-time, recurring)
- Channel selection using preferred channel from auth or leads (with optional “effective channel” from observed behavior)
- Throttling and frequency caps per user and per purpose
- Consent checks: only send marketing to contacts with explicit permission
- Unsubscribe endpoints and preference management (optionally with simple UI)
- Integration with auth-microservice (preferences, consents), leads-microservice (contacts, consent), notifications-microservice (send), orders-microservice (for segmentation)
- Centralized logging via logging-microservice; full audit of campaign runs and consent changes

## Shared Microservices (Required)

This service integrates with:

- **Auth microservice** (`AUTH_SERVICE_URL`) – user identity, marketing preferences, preferred channel, consents
- **Leads microservice** (`LEADS_SERVICE_URL`) – lead contacts and consent (contacts may not be registered)
- **Notifications microservice** (`NOTIFICATION_SERVICE_URL`) – single sending layer for email, Telegram, WhatsApp (via channel registry / `channelKey`)
- **Database server** (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) – campaign and segment data
- **Logging microservice** (`LOGGING_SERVICE_URL`) – centralized logs
- **Orders microservice** (optional, `ORDERS_SERVICE_URL`) – for order-based segments
- **Nginx microservice** – blue/green deployment and routing

## Contact Data and Preferences

- **Registered users**: Contact data and per-user channel preferences (preferred channel, fallback channels, marketing consents) live in **auth-microservice**. Marketing-microservice reads them via API.
- **Leads**: Contact data and consent live in **leads-microservice**; leads may never register. Marketing-microservice must only target leads with explicit marketing consent (e.g. captured at lead form).

Explicit permission for marketing emails is required (e.g. checkbox on registration, account/site options, or site rules/legal). See `docs/agents/master-prompt.md` for full requirements.

## API Overview

- Campaign and segment CRUD
- Campaign execution (scheduled or on-demand, batched)
- Unsubscribe and preference endpoints
- Health check: `GET /health`

Contract definitions are frozen in:

- `docs/agents/contracts/marketing-campaign-contract.md`
- `docs/agents/contracts/preferences-consent-contract.md`
- `docs/agents/contracts/channel-registry-contract.md`
- `docs/agents/contracts/integration-api-matrix.md`

## Configuration

All configuration is provided via `.env`. Do not hardcode values. See `.env.example` for required keys (to be added when the service is implemented). Before any `.env` change, create a backup and add new variable names (keys only) to `.env.example`.

## Deployment (Blue/Green)

When implemented, deployment will follow the shared pattern:

```bash
./scripts/deploy.sh
```

This will call `nginx-microservice/scripts/blue-green/deploy-smart.sh`. Expose API routes via `nginx-api-routes.conf` if the service exposes HTTP APIs. See `shared/docs/CREATE_SERVICE.md` and `shared/docs/DEPLOY_SCRIPT_RULES.md`.

## Logging

All operational and audit logs must be sent to the centralized logging microservice (`LOGGING_SERVICE_URL`). Include timestamps (ISO 8601) and `duration_ms` for operations. Log campaign creation, execution, skips, consent checks, and channel selection decisions.

## Constraints

- Max 30 items per request (e.g. batch size for notification calls).
- Do not increase timeouts; investigate logs and improve batching if delays occur.
- No direct sending of email/messages; all delivery via notifications-microservice.
- Marketing campaigns must only be sent to contacts with explicit consent; honor unsubscribe immediately.

## Documentation

- **Implementation plan and orchestration**: `docs/agents/master-prompt.md` – role, phases, sync points, contracts, and agent tasks for building this service and its integrations (notifications channel registry, auth/leads preferences).
- **Ecosystem**: `shared/README.md` – architecture of shared microservices and applications.
- **New service checklist**: `shared/docs/CREATE_SERVICE.md` – env, logging, deployment, nginx.

## Tech Stack (Planned)

- NestJS (TypeScript) or equivalent; PostgreSQL for campaigns, segments, and execution state.
- Integration via HTTP/REST with auth-microservice, leads-microservice, notifications-microservice, and optionally orders-microservice.

## Status

Phase 1 core implementation is now present in this repository:

- Segment CRUD API
- Campaign CRUD API
- Idempotent campaign execution endpoint with chunked notification calls (`<=30`)
- Consent, unsubscribe, and frequency-cap enforcement in execution path
- Structured decision/outcome logging with ISO timestamps and `duration_ms`

Cross-service ownership boundaries are fixed for cutover:

- Marketing owns campaigns, segments, execution state, and delivery outcomes.
- Auth owns registered-user identity and preferences/consent fields.
- Leads owns lead identity and preferences/consent fields.
- Notifications owns outbound provider execution and channel registry state.

`channelKey` remains optional on `/notifications/send`; when omitted, notifications resolves the legacy default sender path for backward compatibility.
