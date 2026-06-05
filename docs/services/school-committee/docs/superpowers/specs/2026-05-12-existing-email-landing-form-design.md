# Design: Existing-Email Detection on Landing Page Contact Form

**Date:** 2026-05-12  
**Status:** Approved

---

## Problem

When a user who is already registered in auth-microservice fills out the landing page contact form and submits, they receive a leads notification email with a magic link that tries to register them again — which fails with a 409 Conflict. The user has no indication during form entry that they already have an account and should log in instead.

---

## Goal

On the landing page form, when the user leaves the email field (`onBlur`), check whether that email is already registered. If it is, replace the submit button area with an "already registered" notice and login options — while keeping the rest of the form (name, message, voice) visible so the user can still see what they typed.

---

## Architecture

### 1. auth-microservice — new internal endpoint

`GET /auth/internal/check-email?email=<email>`

- Protected by `InternalServiceGuard` (requires `X-Internal-Service-Token` header)
- Returns `{ exists: boolean }`
- Uses `UsersService.findByEmail(email)` — no new DB query logic needed
- Does **not** reveal any user details beyond existence
- File: `src/auth/auth.controller.ts` (new `@Get` route) + no service change needed

### 2. school-committee BFF — new proxy endpoint

`GET /api/auth/check-email?email=<email>`

- No auth required (public — the landing page is unauthenticated)
- Validates `email` param is present and looks like an email (basic format check)
- Forwards to `AUTH_SERVICE_BASE_URL/auth/internal/check-email?email=...` with `X-Internal-Service-Token` header
- Returns `{ exists: boolean }` to the client
- File: `app/api/auth/check-email/route.ts` (new file)

### 3. LandingPage.tsx — on-blur email check

State additions:
- `emailCheckStatus: "idle" | "checking" | "exists" | "not-found" | "error"`

Behavior:
- `onBlur` on the email input: if the contact type is `email` and the value looks like a valid email, fire `GET /api/auth/check-email?email=...`
- While checking: show a subtle spinner next to the email field
- If `exists: true`: set `emailCheckStatus = "exists"` → submit button area is replaced by the "already registered" panel (see below)
- If `exists: false`: set `emailCheckStatus = "not-found"` → form submits normally
- If network error: set `emailCheckStatus = "error"` → form submits normally (fail open — don't block submission)
- Re-check if the user changes the email value after a check

The check only fires when `contactType === "email"`. For whatsapp/telegram/phone, no check is done (those contact types don't map to auth accounts).

### 4. "Already registered" panel — replaces only the submit button area

When `emailCheckStatus === "exists"`, in place of the submit button render:

```
┌─────────────────────────────────────────────────────┐
│ ℹ️  Tento e-mail je již registrován.                │
│                                                     │
│  [Přihlásit se heslem]  [Zaslat přihlašovací odkaz]│
└─────────────────────────────────────────────────────│
```

- "Přihlásit se heslem" → `href="/login?email=<encoded-email>"` (links to login page, email pre-filled via query param)
- "Zaslat přihlašovací odkaz" → calls `POST /api/auth/magic-link` with the email, then shows a small confirmation "Odkaz byl odeslán na váš e-mail." inline (no page navigation)
- The name, message, voice, and contact type fields remain fully visible above this panel
- The GDPR notice remains below

### 5. Login page — accept pre-filled email from query param

`/login?email=<email>` should pre-fill the email field. The login page already reads `useSearchParams()`, so just add reading `email` param and setting initial state. Small change to `app/(public)/login/page.tsx`.

---

## Data Flow

```
User types email → moves focus away (onBlur)
  → GET /api/auth/check-email?email=...   (school-committee BFF)
    → GET /auth/internal/check-email?email=...  (auth-microservice, internal token)
      → UsersService.findByEmail(email)
      → { exists: true | false }
    ← { exists: true | false }
  ← { exists: true | false }

If exists=true:
  Submit area replaced with login options
  "Zaslat přihlašovací odkaz" → POST /api/auth/magic-link → magic link email sent
  "Přihlásit se heslem" → redirect to /login?email=<email>

If exists=false:
  Form submits normally via POST /api/leads/submit
```

---

## Security

- The check-email endpoint reveals whether an email is registered. This is an intentional UX trade-off acceptable for a closed school community platform. It is rate-limited implicitly by auth-microservice's existing rate-limit infrastructure; no additional rate limiting is added in the BFF for MVP.
- The internal endpoint uses `InternalServiceGuard` — only services with the shared `INTERNAL_SERVICE_TOKEN` can call it directly. The BFF proxies it using the existing `AUTH_SERVICE_CLIENT_SECRET` env var (which holds the same token).
- No user data beyond `exists: boolean` is returned.

---

## Files Changed

| File | Change |
|------|--------|
| `auth-microservice/src/auth/auth.controller.ts` | Add `GET /auth/internal/check-email` route |
| `school-committee/app/api/auth/check-email/route.ts` | New BFF proxy route |
| `school-committee/app/(landing)/LandingPage.tsx` | Add onBlur check, emailCheckStatus state, replace submit area |
| `school-committee/app/(public)/login/page.tsx` | Read `email` query param to pre-fill email field |

---

## Out of Scope

- Rate limiting the BFF check-email endpoint (can be added later)
- Checking whatsapp/telegram/phone contacts against auth (those aren't auth credentials)
- Any change to the leads submission flow for non-email contact types
