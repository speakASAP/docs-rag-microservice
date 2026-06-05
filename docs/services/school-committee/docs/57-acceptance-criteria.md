# Release Acceptance Criteria

## MVP release criteria

The MVP can be released only if all below are true.

## Functional

- parent can register through external auth
- parent can complete onboarding
- parent can select class
- parent can select participation type
- parent can generate QR payment
- admin can mark payment paid
- parent sees own payment history
- school/committee can create task
- parent can claim task
- claimed task cannot be claimed by another parent
- parent can submit feedback
- admin can moderate feedback
- public report shows aggregated finances
- admin can export CSV

## Security

- unauthenticated users cannot access app pages
- parent cannot access admin
- parent cannot see other parent payment history
- payment confirmation is admin/committee only
- task verification is privileged
- audit logs created for sensitive actions
- secrets are not committed

## GDPR

- privacy policy page exists
- consent is recorded
- account deletion request exists
- child data minimized
- no public individual payment status
- anonymous feedback does not show author
- public reports contain no unnecessary personal data

## UX

- works on mobile viewport
- onboarding can be completed on phone
- QR payment page is readable on phone
- main actions visible from dashboard
- language selection works
- empty states exist

## Operational

- app deploys to Kubernetes
- health endpoints exist
- logs contain request ID
- basic metrics available or planned
- rollback procedure documented
