# Payment Architecture for Czechia

## MVP recommendation

Use Czech QR bank payments as the default.

Do not prioritize Stripe for MVP. In Czech parent/community contexts, QR bank transfer is usually more familiar and cheaper.

## Payment method: QR Platba

The platform generates a QR code that fills banking app payment details:

- bank account / IBAN
- amount
- currency CZK
- variable symbol
- constant symbol optional
- specific symbol optional
- payment message

## Payment lifecycle

```text
created
  -> pending
  -> paid
  -> reconciled
  -> optionally corrected/refunded
```

## Payment statuses

- draft
- pending
- paid
- failed
- cancelled
- refunded
- manually_corrected

## Variable symbol strategy

Every payment intent gets unique variable symbol.

Recommended format:

```text
YYMM + 6 digit sequence
```

Example:

```text
2605012345
```

Alternative:

```text
school_id + short user id + period
```

But Czech banks often have numeric constraints, so keep it numeric.

## Payment intent

When parent clicks `Generate QR payment`, create payment intent:

```json
{
  "id": "pay_123",
  "userId": "user_123",
  "amountCzk": 500,
  "currency": "CZK",
  "variableSymbol": "2605012345",
  "status": "pending",
  "expiresAt": "2026-06-07T00:00:00Z"
}
```

## QR payload

QR generator should produce QR according to Czech QR payment standard.

Stored fields:

- account
- amount
- currency
- variable symbol
- message

Do not store bank login data.

## Reconciliation options

### MVP manual reconciliation

Committee/admin uploads bank CSV or manually marks payment as paid.

Pros:

- fast implementation
- no bank API dependency
- low legal complexity

Cons:

- manual work
- risk of mistakes

### Phase 2 CSV import

Admin uploads bank export.

System matches by:

1. variable symbol
2. amount
3. date tolerance
4. sender message if needed

### Phase 3 bank/payment provider integration

Possible providers:

- GoPay
- Comgate
- ThePay
- bank API if account supports it

## Accounting notes

The system is not an accounting system.

It tracks:

- contribution intents
- received payments
- expenses
- public report summaries

Official accounting should remain in accounting process of legal entity.

## Public reporting

Public reports should show:

- total collected
- total spent
- expense categories
- completed tasks

Do not show individual parent payment status publicly.

## Transparent account caution

Transparent accounts increase trust but may expose payer names and payment messages.

For GDPR minimization, prefer:

- normal account owned by spolek
- platform-level aggregated transparency
- published expense reports
- optional redacted bank statements

## Security

- no card data
- no bank login data
- webhook secrets in Vault
- payment records immutable after confirmation
- corrections require audit reason
