# Context: GDPR

Source of truth: `docs/41-gdpr-and-data-protection.md`, `docs/42-child-safety-and-moderation.md`

## Data minimization rules

| Data | Collect | Avoid |
|------|---------|-------|
| Parent name | yes (first + last) | — |
| Parent email | yes | — |
| Parent phone | optional only | — |
| Child full name | **no** (MVP) | full legal name |
| Child birth date | birth year only | exact date |
| Child health/behavioral data | **never** | — |
| Child photos | **never** (MVP) | — |
| Payment sender name | avoid | from bank statement |
| Payment amount | yes (intent only) | bank sender details |

## Consent types (must be stored with timestamp + version)

- `terms_accepted`
- `privacy_policy_accepted`
- `parent_committee_participation`
- `communication_notifications` (optional)

## Do not expose publicly

- Individual parent payment status
- Anonymous feedback author identity
- Full child names in any list/export

## Retention guidelines

| Data | Retention |
|------|-----------|
| Profile | Until deletion request |
| Payments | Per Czech accounting law |
| Expenses | Per Czech accounting law |
| Feedback | 12-24 months |
| Audit logs | 24-60 months |
| Deleted account | Anonymize, don't delete if audit trail needed |

## Account deletion

- Anonymize profile fields (name → "Deleted User", email → hash)
- Retain audit log skeleton (user_id stays as reference but no PII)
- Admin processes manually in MVP

## DPIA trigger

Stop and escalate to human if:
- Child accounts are being added
- Profiling or behavioral tracking is introduced
- Large-scale monitoring or analytics is introduced
- Transparent bank account integration is added
