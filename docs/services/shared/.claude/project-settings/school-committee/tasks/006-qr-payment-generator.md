# Task 006: QR Payment Generator

**Status:** ready
**Epic:** EPIC-005 QR Payments
**Depends on:** 001

## Context

Czech QR bank payment (QR Platba) is the MVP payment method. When a parent requests a payment, the BFF generates a QR code containing the bank account details and unique variable symbol. This must be entirely server-side — no payment data assembly on the client.

## Objective

Create the QR payment generation utility and the BFF API endpoint that returns a QR payload for a given payment intent. The QR must conform to Czech QR Platba standard.

## Relevant docs

- `docs/17-payment-architecture-cz.md` — QR fields, variable symbol format, lifecycle, security
- `docs/44-payment-accounting-and-reconciliation.md` — reconciliation strategy
- `docs/32-api-rest-contracts.md` — payment API endpoints
- `docs/40-security-model.md` — payment security rules

## Files likely touched

- `lib/payments/qr-generator.ts` — Czech QR Platba payload builder
- `lib/payments/variable-symbol.ts` — unique variable symbol generator
- `lib/payments/payment-intent.ts` — create/validate payment intent
- `app/api/payments/qr/route.ts` — BFF endpoint: POST → returns QR data
- `types/payments.ts` — PaymentIntent, QrPayload types
- Unit test files for qr-generator and variable-symbol

## Implementation constraints

- QR generation is **server-side only** — the API route returns QR image data or payload string, never raw bank account details to client
- Variable symbol must be **numeric only**, max 10 digits
- Recommended format: `YYMM` + 6-digit zero-padded sequence from DB service
- Amount must be validated: positive integer CZK, > 0, max configurable limit
- Currency must always be `CZK`
- Payment account details (`PAYMENT_ACCOUNT_IBAN`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_BANK_CODE`) come from Vault (K8s secret), never from request body
- POST /api/payments/qr requires authenticated user with `parent` role minimum
- Rate limit: 20 requests/hour/user (per docs/13)
- Payment intent must be created in DB service before QR is returned
- QR payload must follow Czech QR Platba standard (`SPD` format or compatible library)

## Acceptance criteria

- [ ] `lib/payments/qr-generator.ts` generates valid Czech QR Platba payload from: account, amount, currency, variable symbol, message
- [ ] Variable symbol generator produces unique 10-digit numeric strings
- [ ] `POST /api/payments/qr` creates payment intent in DB service and returns QR data
- [ ] Amount validation: rejects 0, negative, non-integer, > MAX_AMOUNT
- [ ] Bank account details never appear in API response (QR payload only)
- [ ] Unauthenticated request returns 401
- [ ] Unit tests cover: valid QR generation, invalid amount, variable symbol uniqueness, missing account config

## Tests required

- Unit test: `qr-generator` with valid inputs produces correct QR Platba format
- Unit test: `qr-generator` rejects invalid CZK amounts (0, negative, non-numeric)
- Unit test: `variable-symbol` produces 10-digit numeric strings
- Unit test: `variable-symbol` produces unique values across 1000 calls
- Integration test: POST /api/payments/qr authenticated → returns QR payload and variable symbol
- Security test: POST /api/payments/qr unauthenticated → 401
- Security test: QR API response does not contain `PAYMENT_ACCOUNT_IBAN` raw value

## Do not

- Do not generate QR codes on the client side
- Do not accept `accountNumber` or `iban` from the request body
- Do not store bank sender personal data
- Do not use Stripe or any card payment library
- Do not allow the same variable symbol to be issued twice
- Do not skip audit event on payment intent creation
