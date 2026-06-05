# GDPR and Data Protection

## Disclaimer

This document is an implementation guide, not legal advice. Final setup must be reviewed by a Czech/EU legal or data protection professional before production.

## Data protection principle

Collect the least amount of data needed to operate the parent committee platform.

## Personal data categories

### Parent data

- first name
- last name
- email
- phone optional
- language
- class association
- participation type
- payment status

### Child data

MVP should store only:

- class relationship
- optional display label
- optional birth year

Avoid:

- full child name
- exact birth date
- health data
- behavioral notes
- photos of children unless separate consent exists

### Payment data

- payment intent
- amount
- variable symbol
- status
- paid timestamp
- reconciliation reference

Avoid storing bank sender personal data unless needed for reconciliation.

## Lawful basis

Likely bases:

- consent for optional participation and platform registration
- legitimate interest for operational records of the spolek
- legal obligation for accounting where applicable

Must be reviewed legally.

## Consent management

Store:

- consent type
- version
- timestamp
- user id
- source
- revoked timestamp if applicable

Consent types:

- terms accepted
- privacy policy accepted
- parent committee participation
- child idea submission optional
- communication notifications optional

## Data subject rights

Support process for:

- access
- correction
- deletion
- restriction
- portability if applicable
- objection

MVP can implement:

- account deletion request
- manual export by admin
- profile correction

## Data minimization rules

- do not import parent list from school
- do not ask for unnecessary child data
- do not show individual payment status publicly
- do not expose anonymous feedback author
- do not store raw voice files in MVP unless needed
- do not include personal data in event payloads unnecessarily

## Retention policy

Suggested:

| Data | Retention |
|---|---|
| profile | until account deletion or membership end |
| payments | according to accounting/legal requirements |
| expenses | according to accounting/legal requirements |
| feedback | 12-24 months unless needed longer |
| audit logs | 24-60 months depending on policy |
| task photos | delete when no longer needed |
| deleted accounts | anonymize where possible |

## Transparent account risk

Transparent bank accounts may expose:

- payer name
- amount
- message
- transaction date

This can conflict with minimization and privacy expectations.

Recommendation:

- prefer normal account owned by spolek
- publish aggregated reports
- publish expense-level transparency
- avoid public parent-level payment visibility

## Processor agreements

Need agreements or terms with:

- hosting provider
- auth provider if external legal entity
- DB provider
- email provider
- storage provider
- payment provider
- analytics provider

## DPIA

A formal DPIA may be needed if child data, profiling or large-scale monitoring is introduced.

For MVP:

- avoid child accounts
- avoid profiling
- avoid sensitive data
- avoid public child data

## Privacy-by-design checklist

- privacy policy published
- consent versioning
- minimal child fields
- no school parent data import
- role-based access
- audit logs
- deletion request
- export process
- public transparency without personal payment listing
