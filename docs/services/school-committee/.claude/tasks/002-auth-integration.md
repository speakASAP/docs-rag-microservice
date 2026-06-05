# Task 002: Auth Integration

**Status:** done
**Epic:** EPIC-002 Auth Integration
**Depends on:** 001

## Context

The platform must not implement authentication internally. The auth-microservice owns identity, JWT issuance, login, and password reset. This task wires the BFF layer to validate JWT tokens from auth-microservice and expose a `currentUser()` server utility that all protected routes will use.

## Objective

Create the auth integration layer: JWT validation middleware, protected route wrapper, current user extraction, and the token refresh flow. All authentication delegates to auth-microservice at `AUTH_SERVICE_BASE_URL`.

## Relevant docs

- `docs/14-auth-service-contract.md` — endpoints, JWT claims, session model
- `docs/40-security-model.md` — token storage, role checks
- `docs/11-existing-infrastructure-integration.md` — auth validation requirements
- `docs/13-bff-api-layer.md` — BFF auth responsibilities

## Files likely touched

- `lib/auth/validate-token.ts` — JWT validation via auth-microservice JWKS or introspection
- `lib/auth/get-current-user.ts` — extract and verify user from request
- `lib/auth/require-role.ts` — throws ForbiddenError if role insufficient
- `lib/auth/session.ts` — httpOnly cookie management (set/clear access + refresh tokens)
- `app/api/auth/login/route.ts` — proxy to auth-microservice POST /auth/login, sets cookies
- `app/api/auth/logout/route.ts` — clears cookies, calls auth-microservice logout
- `app/api/auth/refresh/route.ts` — refresh token rotation
- `middleware.ts` — Next.js middleware for protected route redirects
- `types/auth.ts` — User, JwtClaims, Role types

## Implementation constraints

- Tokens MUST be stored in httpOnly, Secure, SameSite=Lax cookies only. Never localStorage.
- JWT audience must be validated as `school-committee` (from `AUTH_SERVICE_AUDIENCE` env var)
- Token expiry must be checked
- `require-role.ts` must accept array of allowed roles and check `tenant_id` + `school_id` scoping
- Never trust role from request body or query param — extract from verified token only
- All auth errors must use error codes from `docs/35-error-model.md`: `UNAUTHENTICATED`, `FORBIDDEN`
- `AUTH_SERVICE_CLIENT_SECRET` comes from Vault (K8s secret), never hardcoded

## Acceptance criteria

- [ ] `GET /api/auth/me` returns current user from valid cookie
- [ ] `GET /api/auth/me` returns 401 with `UNAUTHENTICATED` error for missing/expired token
- [ ] Login flow: POST credentials → auth-microservice → set httpOnly cookie → return user
- [ ] Logout: clears cookies, calls auth-microservice logout
- [ ] Token refresh: rotates access token using refresh token cookie
- [ ] `require-role(['committee', 'admin'])` throws `FORBIDDEN` for `parent` role
- [ ] Protected page redirects unauthenticated user to login
- [ ] Email-unverified user blocked if auth service token indicates it
- [ ] Middleware protects `/dashboard` and `/admin` routes

## Tests required

- Unit test: expired token rejected
- Unit test: wrong audience rejected
- Unit test: `require-role` blocks insufficient role
- Unit test: `require-role` allows correct role
- Integration test: POST /api/auth/login with valid credentials sets cookie
- Integration test: POST /api/auth/logout clears cookie
- Security test: parent cannot access admin-only route

## Do not

- Do not implement password hashing or user storage — auth-microservice owns this
- Do not store tokens in localStorage or any client-accessible storage
- Do not trust `role` from request body
- Do not skip audience validation
- Do not hardcode `AUTH_SERVICE_CLIENT_SECRET`
