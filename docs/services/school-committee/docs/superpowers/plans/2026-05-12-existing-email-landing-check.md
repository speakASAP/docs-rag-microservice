# Existing-Email Detection on Landing Page Contact Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user types a registered email in the landing page contact form and moves focus away, show an inline "already registered" panel with login options instead of letting them submit a redundant lead.

**Architecture:** Four changes across two services. auth-microservice gains a new internal `GET /auth/internal/check-email` endpoint. school-committee gains a BFF proxy `GET /api/auth/check-email` and updates `LandingPage.tsx` to fire an `onBlur` check that replaces the submit button with login options if the email exists. The login page gains email pre-fill from query param.

**Tech Stack:** NestJS (auth-microservice), Next.js 14 App Router + TypeScript strict (school-committee), Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `auth-microservice/src/auth/auth.controller.ts` | Modify | Add `GET /auth/internal/check-email` route |
| `school-committee/app/api/auth/check-email/route.ts` | Create | BFF proxy — validates param, forwards to auth with internal token |
| `school-committee/app/(landing)/LandingPage.tsx` | Modify | Add `emailCheckStatus` state, `onBlur` handler, already-registered panel, magic-link sender |
| `school-committee/app/(public)/login/page.tsx` | Modify | Read `email` query param to pre-fill email field initial state |

---

### Task 1: Add `GET /auth/internal/check-email` to auth-microservice

**Files:**
- Modify: `auth-microservice/src/auth/auth.controller.ts`

The `InternalServiceGuard` is already wired and used by other internal routes in this controller. `UsersService.findByEmail()` already exists. This is a pure addition — no other files need to change.

- [ ] **Step 1: Add the route to auth.controller.ts**

Open `auth-microservice/src/auth/auth.controller.ts`. After the existing `@Post('internal/magic-link/token')` block (around line 156), add:

```typescript
  @Get('internal/check-email')
  @UseGuards(InternalServiceGuard)
  async checkEmailExists(@Query('email') email: string) {
    if (!email) {
      return { exists: false };
    }
    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    return { exists: !!user };
  }
```

Also add `Query` to the imports at the top (it's already imported — verify it's in the destructured list from `@nestjs/common`). `UsersService` is already injected via `constructor(private readonly authService: AuthService)` — but note the controller only has `authService`, not `usersService` directly. Check: the controller calls `this.authService.*` for everything. So call through the service:

Actually `UsersService` is NOT directly available in the controller — only `AuthService` is injected. Add a pass-through method to `AuthService` instead, or expose `UsersService` directly. The simpler path: add a method to `AuthService` and call it from the controller.

- [ ] **Step 2: Add `checkEmailExists` to auth.service.ts**

Open `auth-microservice/src/auth/auth.service.ts`. Add this method to the `AuthService` class (place it near other user-lookup methods):

```typescript
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    return !!user;
  }
```

- [ ] **Step 3: Update the controller to call the service method**

In `auth-microservice/src/auth/auth.controller.ts`, add the route using `authService`:

```typescript
  @Get('internal/check-email')
  @UseGuards(InternalServiceGuard)
  async checkEmailExists(@Query('email') email: string) {
    if (!email) {
      return { exists: false };
    }
    const exists = await this.authService.checkEmailExists(email);
    return { exists };
  }
```

Make sure `Query` is in the `@nestjs/common` import at the top of the file. It should already be there since other routes use `@Query`. Verify the import line looks like:

```typescript
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
```

- [ ] **Step 4: Verify the endpoint works**

```bash
cd /home/ssf/Documents/Github/auth-microservice
./scripts/deploy.sh
```

Then test from outside:
```bash
INTERNAL_TOKEN="BCKtXDWiNEk0H4tG-C31z_J1s0I944FFAQMNvFY5cMMeF6MCRNSSF0bsfWnHeTUD"
curl -s "https://auth.alfares.cz/auth/internal/check-email?email=ssfskype@gmail.com" \
  -H "x-internal-service-token: $INTERNAL_TOKEN"
# Expected: {"exists":true}

curl -s "https://auth.alfares.cz/auth/internal/check-email?email=nobody@nowhere.com" \
  -H "x-internal-service-token: $INTERNAL_TOKEN"
# Expected: {"exists":false}

curl -s "https://auth.alfares.cz/auth/internal/check-email?email=ssfskype@gmail.com"
# Expected: 403 (no token)
```

---

### Task 2: Add BFF proxy `GET /api/auth/check-email` to school-committee

**Files:**
- Create: `school-committee/app/api/auth/check-email/route.ts`

This is a new file. The pattern follows other BFF routes in `app/api/auth/`. It reads `AUTH_SERVICE_BASE_URL` and `AUTH_SERVICE_CLIENT_SECRET` from env (already in ConfigMap/Secret). No auth cookie required — this endpoint is public (landing page is unauthenticated).

- [ ] **Step 1: Create the route file**

Create `school-committee/app/api/auth/check-email/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL ?? "";
const AUTH_SERVICE_CLIENT_SECRET = process.env.AUTH_SERVICE_CLIENT_SECRET ?? "";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  if (!AUTH_SERVICE_BASE_URL || !AUTH_SERVICE_CLIENT_SECRET) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  try {
    const upstream = await fetch(
      `${AUTH_SERVICE_BASE_URL}/auth/internal/check-email?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "x-internal-service-token": AUTH_SERVICE_CLIENT_SECRET,
          "x-service-name": "school-committee",
        },
        cache: "no-store",
      },
    );

    if (!upstream.ok) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    const data = (await upstream.json()) as { exists?: boolean };
    return NextResponse.json({ exists: !!data.exists }, { status: 200 });
  } catch {
    return NextResponse.json({ exists: false }, { status: 200 });
  }
}
```

Note: on error or misconfiguration, this always returns `{ exists: false }` — the "fail open" behaviour specified in the design. The landing form will submit normally if the check fails.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1
# Expected: no output (no errors)
```

---

### Task 3: Update LandingPage.tsx — onBlur check + already-registered panel

**Files:**
- Modify: `school-committee/app/(landing)/LandingPage.tsx`

This is the largest change. The form currently has no email-existence awareness. We add:
1. `emailCheckStatus` state
2. `handleEmailBlur` async function
3. Reset `emailCheckStatus` to `"idle"` when `contactValue` changes (so the check re-fires if email is edited)
4. A conditional render below the submit button area
5. A `sendMagicLink` function for the "Zaslat přihlašovací odkaz" button
6. Czech translations for the new strings in both `cs` and `en` objects

The existing submit button logic uses `disabled={submitting}`. The already-registered panel replaces the button entirely when `emailCheckStatus === "exists"`.

- [ ] **Step 1: Add translations to the `T` object**

In `LandingPage.tsx`, inside both the `cs` and `en` translation objects, add new keys after the existing `errorFailed` key:

For `cs`:
```typescript
    alreadyRegisteredNotice: "Tento e-mail je již registrován.",
    loginWithPassword: "Přihlásit se heslem",
    sendMagicLink: "Zaslat přihlašovací odkaz",
    magicLinkSent: "Odkaz byl odeslán na váš e-mail.",
    magicLinkFailed: "Nepodařilo se odeslat odkaz. Zkuste to znovu.",
```

For `en`:
```typescript
    alreadyRegisteredNotice: "This email is already registered.",
    loginWithPassword: "Sign in with password",
    sendMagicLink: "Send login link",
    magicLinkSent: "A login link has been sent to your email.",
    magicLinkFailed: "Failed to send the link. Please try again.",
```

- [ ] **Step 2: Add `emailCheckStatus` state and `magicLinkSentStatus` state**

After the existing `const [error, setError] = useState<string | null>(null);` line, add:

```typescript
  const [emailCheckStatus, setEmailCheckStatus] = useState<"idle" | "checking" | "exists" | "not-found" | "error">("idle");
  const [magicLinkSentStatus, setMagicLinkSentStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
```

- [ ] **Step 3: Reset emailCheckStatus when contactValue changes**

Find the `onChange` handler on the contact value input:
```typescript
onChange={(e) => setContactValue(e.target.value)}
```

Replace it with:
```typescript
onChange={(e) => {
  setContactValue(e.target.value);
  if (emailCheckStatus !== "idle") {
    setEmailCheckStatus("idle");
    setMagicLinkSentStatus("idle");
  }
}}
```

- [ ] **Step 4: Add `handleEmailBlur` function**

After the `scrollToForm` function definition, add:

```typescript
  const handleEmailBlur = async () => {
    if (contactType !== "email") return;
    const trimmed = contactValue.trim();
    if (!trimmed.includes("@") || trimmed.length < 5) return;
    setEmailCheckStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(trimmed)}`);
      if (!res.ok) { setEmailCheckStatus("error"); return; }
      const data = (await res.json()) as { exists?: boolean };
      setEmailCheckStatus(data.exists ? "exists" : "not-found");
    } catch {
      setEmailCheckStatus("error");
    }
  };
```

- [ ] **Step 5: Add `sendMagicLink` function**

After `handleEmailBlur`, add:

```typescript
  const sendMagicLink = async () => {
    setMagicLinkSentStatus("sending");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactValue.trim() }),
      });
      setMagicLinkSentStatus(res.ok ? "sent" : "error");
    } catch {
      setMagicLinkSentStatus("error");
    }
  };
```

- [ ] **Step 6: Add `onBlur` to the contact value input**

Find the contact value `<input>` element (it has `type={contactType === "email" ? "email" : "tel"}`). Add `onBlur={handleEmailBlur}` to it:

```tsx
<input
  type={contactType === "email" ? "email" : "tel"}
  required
  placeholder={t.contactValuePlaceholders[contactType]}
  value={contactValue}
  onChange={(e) => {
    setContactValue(e.target.value);
    if (emailCheckStatus !== "idle") {
      setEmailCheckStatus("idle");
      setMagicLinkSentStatus("idle");
    }
  }}
  onBlur={handleEmailBlur}
  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

Also add a small checking indicator directly below the input (after the closing `</div>` of the contact section):

```tsx
{contactType === "email" && emailCheckStatus === "checking" && (
  <p className="text-xs text-gray-400 mt-1">Ověřuji e-mail…</p>
)}
```

- [ ] **Step 7: Replace the submit button area with conditional render**

Find the submit `<button>` block:

```tsx
<button
  type="submit"
  disabled={submitting}
  className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
>
  {submitting ? t.submitting : t.submit}
</button>
```

Replace it with:

```tsx
{emailCheckStatus === "exists" ? (
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
    <p className="text-sm font-medium text-blue-800">{t.alreadyRegisteredNotice}</p>
    {magicLinkSentStatus === "sent" ? (
      <p className="text-sm text-green-700">{t.magicLinkSent}</p>
    ) : magicLinkSentStatus === "error" ? (
      <p className="text-sm text-red-600">{t.magicLinkFailed}</p>
    ) : (
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={`/login?email=${encodeURIComponent(contactValue.trim())}`}
          className="flex-1 text-center bg-blue-600 text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-blue-700 transition-colors"
        >
          {t.loginWithPassword}
        </a>
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={magicLinkSentStatus === "sending"}
          className="flex-1 bg-white border border-blue-300 text-blue-700 font-semibold rounded-xl py-2.5 text-sm hover:bg-blue-50 disabled:opacity-50 transition-colors"
        >
          {magicLinkSentStatus === "sending" ? "Odesílám…" : t.sendMagicLink}
        </button>
      </div>
    )}
  </div>
) : (
  <button
    type="submit"
    disabled={submitting}
    className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
  >
    {submitting ? t.submitting : t.submit}
  </button>
)}
```

- [ ] **Step 8: Verify TypeScript compiles cleanly**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1
# Expected: no output (no errors)
```

---

### Task 4: Pre-fill email on login page from query param

**Files:**
- Modify: `school-committee/app/(public)/login/page.tsx`

The `LoginForm` component already uses `useSearchParams()` to read `next`. Add reading of `email` param to pre-fill the email field initial state.

- [ ] **Step 1: Read email param and use as initial state**

In `LoginForm`, find:
```typescript
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
```

Replace with:
```typescript
  const next = searchParams.get("next") ?? "/dashboard";
  const emailParam = searchParams.get("email") ?? "";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(emailParam);
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1
# Expected: no output
```

---

### Task 5: Deploy and verify end-to-end

- [ ] **Step 1: Deploy auth-microservice**

```bash
cd /home/ssf/Documents/Github/auth-microservice
./scripts/deploy.sh
```

Wait for rollout:
```bash
kubectl rollout status deployment/auth-microservice -n statex-apps
```

- [ ] **Step 2: Verify check-email endpoint on auth**

```bash
INTERNAL_TOKEN="BCKtXDWiNEk0H4tG-C31z_J1s0I944FFAQMNvFY5cMMeF6MCRNSSF0bsfWnHeTUD"
curl -s "https://auth.alfares.cz/auth/internal/check-email?email=ssfskype@gmail.com" \
  -H "x-internal-service-token: $INTERNAL_TOKEN"
# Expected: {"exists":true}

curl -s "https://auth.alfares.cz/auth/internal/check-email?email=nobody@nowhere.com" \
  -H "x-internal-service-token: $INTERNAL_TOKEN"
# Expected: {"exists":false}
```

- [ ] **Step 3: Deploy school-committee**

```bash
cd /home/ssf/Documents/Github/school-committee
./scripts/deploy.sh
```

Wait for rollout:
```bash
kubectl rollout status deployment/school-committee -n statex-apps
```

- [ ] **Step 4: Verify BFF proxy**

```bash
curl -s "https://strilkove.cz/api/auth/check-email?email=ssfskype@gmail.com"
# Expected: {"exists":true}

curl -s "https://strilkove.cz/api/auth/check-email?email=nobody@nowhere.com"
# Expected: {"exists":false}
```

- [ ] **Step 5: Verify the landing page UX**

Open `https://strilkove.cz/` in a browser.

1. Scroll to the contact form. Select "Email" contact type.
2. Type `ssfskype@gmail.com` in the email field and click elsewhere (blur).
3. Expected: a blue panel appears where the submit button was, showing "Tento e-mail je již registrován." with two buttons.
4. Click "Přihlásit se heslem" — should navigate to `/login?email=ssfskype%40gmail.com` with the email field pre-filled.
5. Go back to the landing page. Type `ssfskype@gmail.com` again, blur, then click "Zaslat přihlašovací odkaz".
6. Expected: button changes to "Odesílám…" briefly, then "Odkaz byl odeslán na váš e-mail." appears.
7. Type a non-registered email (e.g. `brand-new@test.com`), blur — submit button should reappear normally.
