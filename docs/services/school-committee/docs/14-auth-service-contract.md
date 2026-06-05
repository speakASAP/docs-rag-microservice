# Auth Service Contract

## Ownership

The external auth service owns:

- identity
- login
- password reset
- email verification
- session lifecycle
- token issuance
- role claims if supported

The platform owns:

- parent profile
- participation type
- class assignment
- GDPR consent records
- domain-specific permissions

## Required auth endpoints

```http
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/password-reset
POST /auth/email/verify
GET  /auth/me
GET  /.well-known/jwks.json
```

## Token requirements

JWT claims:

```json
{
  "sub": "user_123",
  "email": "parent@example.com",
  "email_verified": true,
  "roles": ["parent"],
  "tenant_id": "tenant_001",
  "school_id": "school_001",
  "iat": 1710000000,
  "exp": 1710003600,
  "iss": "auth-service",
  "aud": "school-committee"
}
```

## Session storage

Preferred:

- httpOnly secure cookies
- SameSite=Lax or Strict
- short-lived access token
- refresh token rotation

Avoid:

- localStorage tokens
- long-lived browser tokens
- frontend-managed role state as source of truth

## Registration flow

Auth service creates identity.

Platform completes domain profile:

```text
auth register -> email verification -> onboarding profile -> dashboard
```

## Role synchronization

Two possible models:

### Model A: Auth service owns global roles

Auth service token includes roles.

Platform checks roles from token.

### Model B: Platform owns domain roles

Auth token includes user ID only.

Platform queries DB service for roles.

### Recommendation

Use Model B if parent committee roles are application-specific. Use Model A only for coarse roles.

## Required auth integration tests

- unverified user cannot complete onboarding
- expired token rejected
- invalid audience rejected
- missing role rejected
- admin role required for role assignment
- refresh token rotation works
