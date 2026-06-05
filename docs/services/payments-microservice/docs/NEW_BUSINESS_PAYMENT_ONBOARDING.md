# New Business Payment Onboarding

## Purpose

This document defines how any new business/application in the ecosystem registers with `payments-microservice` to accept payments in a unified way.

## Required Consumer Contract

Add these variables to the new service `.env`:

- `PAYMENT_APPLICATION_ID` — unique application identifier (recommended: repo/service slug).
- `PAYMENT_SERVICE_URL` — payments endpoint (for example `https://payments.alfares.cz`).
- `PAYMENT_API_KEY` — key sent as `X-API-Key` on `POST /payments/create`, `GET /payments/:id`, refund.
- `PAYMENT_WEBHOOK_API_KEY` — key expected by the consumer webhook endpoint.
- `PAYMENT_CALLBACK_URL` — consumer webhook URL (for example `https://service.domain/api/webhooks/payment-result`).
- `PAYMENT_SUCCESS_URL` — where Stripe should return users on success.
- `PAYMENT_CANCEL_URL` — where Stripe should return users on cancel.

## Required Payments Backend Registration

Register the consumer in `payments-microservice/.env`:

1. Add `PAYMENT_API_KEY` into `API_KEYS` (comma-separated allowlist).
2. Add `PAYMENT_APPLICATION_ID:PAYMENT_WEBHOOK_API_KEY` into `PAYMENT_CALLBACK_API_KEYS`.

Example:

```env
API_KEYS=...,new-business-pay-key
PAYMENT_CALLBACK_API_KEYS=...,new-business:new-business-webhook-key
```

## API Request Contract

Consumer calls `POST /payments/create` with:

- `applicationId` = `PAYMENT_APPLICATION_ID`
- `callbackUrl` = `PAYMENT_CALLBACK_URL`
- `successUrl` = `PAYMENT_SUCCESS_URL` (recommended)
- `cancelUrl` = `PAYMENT_CANCEL_URL` (recommended)

If `successUrl` / `cancelUrl` are omitted for Stripe, payments-microservice derives defaults from callback URL origin.

## Verification Checklist

1. Create test payment request from consumer with its own `applicationId`.
2. Complete checkout and verify frontend return URL behavior.
3. Confirm Stripe sends webhook events to `https://payments.alfares.cz/webhooks/stripe` (`checkout.session.completed` and `payment_intent.*`).
4. Confirm `GET /payments/:id` transitions from `processing` to `completed` (or `failed`) after webhook handling.
5. Confirm payments-microservice posts callback to consumer `PAYMENT_CALLBACK_URL`.
6. Confirm consumer validates `X-API-Key` using `PAYMENT_WEBHOOK_API_KEY`.
7. Run refund and verify state synchronization.

## Security Notes

- Never share keys between unrelated businesses.
- Keep keys only in `.env` (never in code/docs).
- Rotate keys by updating consumer `.env` and payments registration together.
