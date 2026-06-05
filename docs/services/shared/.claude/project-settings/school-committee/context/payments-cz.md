# Context: Czech QR Payments

Source of truth: `docs/17-payment-architecture-cz.md`, `docs/44-payment-accounting-and-reconciliation.md`

## MVP payment method: QR Platba

Czech standard QR bank payment. Parents scan QR code in their banking app. No card data, no bank credentials.

## QR payload fields

| Field | Required | Notes |
|-------|----------|-------|
| IBAN / account number | yes | From Vault: `PAYMENT_ACCOUNT_IBAN` |
| Amount (CZK) | yes | Must be > 0 integer |
| Currency | yes | Always `CZK` |
| Variable symbol | yes | Unique per payment intent |
| Message | optional | Brief description |
| Constant symbol | optional | |

## Variable symbol format

Numeric only (Czech bank constraint).

Recommended: `YYMM` + 6-digit sequence = 10 digits total.

Example: `2605012345` = May 2026, sequence 012345.

Alternative: use `payment_intent.id` truncated to numeric digits, but ensure uniqueness.

## Payment lifecycle

```
draft → pending → paid → reconciled
         ↓              ↓
       cancelled    manually_corrected
```

## Reconciliation (MVP)

Manual only. Committee/admin:
1. Receives bank statement
2. Matches by variable symbol
3. Marks payment as `paid` in admin panel with bank reference

Phase 2: CSV bank import matching by variable symbol + amount + date tolerance.

## Security rules

- QR codes are **server-generated only** — never assemble payment data on client
- Payment records are **immutable after `paid`** — use correction flow with audit reason
- No card data stored anywhere
- No banking credentials stored anywhere
- Webhook secrets (future) in Vault only

## Public reporting

Show:
- Total collected (aggregated)
- Total spent (per expense)
- Balance

Never show:
- Individual parent payment amounts
- Payer names
- Bank statement lines
