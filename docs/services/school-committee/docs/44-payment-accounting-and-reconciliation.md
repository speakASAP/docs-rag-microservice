# Payment Accounting and Reconciliation

## Payment sources

MVP:

- Czech QR bank transfer

Future:

- CSV bank import
- payment gateway
- bank API

## Payment lifecycle

1. Parent creates payment intent.
2. System generates QR code.
3. Parent pays through bank app.
4. Bank receives payment.
5. Committee reconciles payment.
6. Payment intent status becomes paid.
7. Public aggregate report updates.

## Payment intent fields

- id
- user_id
- amount_czk
- currency
- variable_symbol
- status
- created_at
- expires_at
- paid_at

## Reconciliation matching

Match by:

1. variable symbol
2. amount
3. received date
4. message/reference

## Manual reconciliation process

1. Admin opens pending payments.
2. Compares bank statement.
3. Selects payment.
4. Clicks mark as paid.
5. Enters reference.
6. System creates audit log.

## CSV import process

Future:

1. Admin downloads CSV from bank.
2. Uploads CSV.
3. System parses rows.
4. System suggests matches.
5. Admin confirms.
6. Payments are marked paid.

## Handling overpayment

Options:

- record extra as donation
- refund manually
- carry forward

Must be defined by committee policy.

## Handling underpayment

Options:

- mark partially paid
- keep pending
- manually correct

MVP recommendation:

- avoid partial payments
- require manual correction with audit reason

## Refunds

QR bank payments require manual bank transfer refund.

System should record:

- refund amount
- reason
- reference
- actor
- timestamp

## Public report update

Public report must aggregate:

- collected total
- spent total
- current balance
- expenses by category
- completed tasks

Do not expose:

- parent-level payment status
- payer names
- bank account details beyond payment instructions
