# Legal Structure in Czechia

## Disclaimer

This is not legal advice. It is a product and architecture planning document. A Czech lawyer/accountant should validate the final setup.

## Main question

Who should own the bank account for parent committee contributions?

## Unsafe option: personal parent account

Avoid using a personal bank account of one parent.

Risks:

- unclear ownership
- tax/accounting issues
- trust issues
- personal liability
- continuity problem when parent leaves
- GDPR/payment privacy issues
- disputes about money

## School account

Usually not suitable if:

- funds are not school funds
- parent committee wants independent spending
- school cannot manage informal committee money
- legal/accounting separation is needed

## Recommended structure

Create or use a legal entity:

```text
zapsaný spolek (z.s.)
```

A spolek can:

- have members
- open bank account
- define statutes
- have committee/board
- keep accounting
- accept contributions/donations depending on setup
- sign provider contracts

## Why spolek is suitable

- clean legal owner
- continuity independent of individual parents
- transparent governance
- bank account belongs to entity
- easier accounting
- clearer responsibility
- can apply for grants/sponsorships

## Required setup checklist

1. Define purpose of spolek.
2. Prepare statutes.
3. Define governing body.
4. Register spolek.
5. Open bank account.
6. Define contribution policy.
7. Define spending approval process.
8. Define accounting process.
9. Define personal data policy.
10. Define relationship with school.

## Relationship with school

Recommended:

- memorandum of cooperation
- school does not transfer parent data
- school can publish platform link/QR
- parents register voluntarily
- school may submit tasks/needs
- committee/spolek manages funds independently

## Transparent account

Transparent account may be useful for trust but is not automatically the best option.

Pros:

- public trust
- easy external visibility
- less suspicion

Cons:

- payer names may be visible
- payment messages may be visible
- parent contribution behavior becomes public
- possible GDPR concerns
- difficult to redact

## Preferred MVP legal/payment model

```text
Spolek-owned normal bank account
+ QR bank payments
+ internal reconciliation
+ public aggregated platform reports
+ published expense list
```

This gives trust without exposing parent-level payment details.

## When to use transparent account

Use only if:

- legal review confirms acceptable privacy model
- parents are clearly informed
- payment messages are controlled
- public visibility is understood
- committee accepts privacy trade-off

## Accounting

The platform should not replace accounting.

Platform tracks operational transparency.

Official accounting should be handled by:

- spolek treasurer
- accountant if needed
- bank statements
- invoices/receipts
- annual reports if required

## Governance recommendation

Require approval rules:

| Expense size | Approval |
|---|---|
| small | committee member |
| medium | two committee members |
| large | committee vote or member approval |

Exact thresholds should be defined by spolek.
