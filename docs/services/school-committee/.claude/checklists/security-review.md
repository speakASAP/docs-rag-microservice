# Checklist: Security Review

Source: `docs/40-security-model.md`

## Authentication and tokens

- [ ] Tokens stored in httpOnly cookies only (never localStorage)
- [ ] Access token is short-lived
- [ ] Refresh token rotation implemented
- [ ] Token validation happens server-side (signature, expiry, audience)
- [ ] Audience claim verified (`school-committee`)

## Authorization

- [ ] Every API route extracts user from verified token (not from request body)
- [ ] Role checked against DB service (not trusted from frontend)
- [ ] `tenant_id` and `school_id` scoping applied on all data queries
- [ ] Frontend role checks are UX-only (not security gates)

## Sensitive operations (require committee or admin role)

- [ ] Mark payment paid: role checked
- [ ] Publish expense: role checked
- [ ] Assign role: admin-only, audit logged
- [ ] Export CSV: admin-only, audit logged
- [ ] Moderate feedback: role checked
- [ ] View audit log: admin-only

## Payment security

- [ ] QR payload generated server-side only
- [ ] No card data collected or stored
- [ ] No bank credentials stored
- [ ] Payment records immutable after `paid` status
- [ ] Payment correction requires audit reason

## File uploads

- [ ] MIME type validated server-side
- [ ] File size limit enforced
- [ ] No executable file extensions accepted
- [ ] Files stored in private bucket
- [ ] Files served via signed URLs only

## Secrets and config

- [ ] No secrets in source code
- [ ] No secrets in ConfigMap (only non-sensitive config there)
- [ ] No secrets in logs
- [ ] No internal URLs in client bundle

## Public endpoints

- [ ] Rate limiting on feedback submission
- [ ] Rate limiting on QR generation
- [ ] No personal data in public report response

## HTTP headers

- [ ] Content-Security-Policy set
- [ ] Strict-Transport-Security set
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy set

## Audit trail

- [ ] Every mutation emits audit event
- [ ] Audit event includes request_id, user_id, action, timestamp
- [ ] Audit records not deletable by regular users
