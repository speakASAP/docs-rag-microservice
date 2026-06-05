# Security Model

## Security goals

- protect parent data
- protect child data
- prevent unauthorized role escalation
- prevent payment manipulation
- keep audit trail
- avoid secret leakage
- reduce risk from public forms

## Authentication

Handled by external auth service.

Requirements:

- verified email
- secure token handling
- short-lived access tokens
- refresh token rotation
- 2FA for admins if supported

## Authorization

Use RBAC.

Every mutation must check:

- authenticated user
- role
- tenant_id
- school_id
- resource scope

Frontend permission checks are UX only. BFF and/or DB service must enforce.

## Roles

- parent
- committee
- teacher
- school_staff
- admin

## Sensitive operations

Require elevated role:

- mark payment paid
- publish expense
- assign role
- export CSV
- moderate feedback
- view audit log

## File security

- private storage by default
- signed URLs
- file size limits
- MIME validation
- no executable uploads
- future malware scanning

## Public endpoints

Public endpoints:

- landing page
- public finance report
- feedback QR form if anonymous public submission allowed

Controls:

- rate limiting
- CAPTCHA optional
- spam detection future
- moderation required

## Payment security

- no card data
- no banking credentials
- payment confirmation is privileged
- manual correction requires reason
- paid records immutable

## Admin security

- 2FA recommended
- separate admin routes
- role assignment audit
- export audit
- no last-admin removal
- session timeout

## Headers

Required:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| parent sees other parent payment | role/scoped API |
| public form spam | rate limits, moderation |
| role escalation | admin-only role API, audit |
| QR payment tampering | server-generated QR only |
| task double-claim | DB atomic operation |
| child data exposure | minimization, no public names |
| secret leak | Vault only |
