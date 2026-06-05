# Context: Security

Source of truth: `docs/40-security-model.md`, `docs/51-coding-standards.md`

## Non-negotiables

1. **No secrets in code, logs, git, or ConfigMap.** Vault only.
2. **No tokens in localStorage.** httpOnly cookies only.
3. **BFF enforces all authorization.** Frontend checks are UX-only.
4. **Every mutation emits an audit event** via DB service audit endpoint.
5. **Every request carries request_id** — propagated to all upstreams.
6. **Payment QR codes are server-generated only.** No client-side payment data assembly.
7. **Payment records are immutable after `paid` status.** Corrections require audit reason.
8. **Task claim is atomic** — DB service must handle race condition, not BFF.

## Required headers on every response

```
Content-Security-Policy: default-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## RBAC enforcement pattern

```typescript
// In every API route handler:
const user = await validateToken(req); // from auth service
const role = await getUserRole(user.sub, tenantId, schoolId); // from DB service
if (!hasPermission(role, action)) throw new ForbiddenError();
```

## Rate limits (MVP)

| Endpoint | Limit |
|----------|-------|
| feedback submit | 5/hour/user or IP |
| QR payment generation | 20/hour/user |
| task comments | 60/hour/user |
| admin mutations | 300/hour/admin |

## Sensitive operations (require committee/admin role)

- mark payment paid
- publish expense
- assign role
- export CSV
- moderate feedback
- view audit log

## File upload security

- validate MIME type server-side (not just Content-Type header)
- enforce max size (e.g. 5MB)
- no executable extensions
- store in private bucket — serve via signed URLs only
