# Auth Integration Design — Business Orchestrator

**Date:** 2026-05-04  
**Status:** Approved

---

## Problem

`orchestrator.alfares.cz` is currently fully public. Anyone who reaches the URL can view all businesses, goals, and projects. Mutation actions (create, update, offboard) already require a JWT, but users must manually paste a token into a text field — a poor UX that exposes the internal auth model. There is also no compelling landing page to convert new visitors into registered users.

## Goal

1. Gate the dashboard behind authentication — unauthenticated visitors see a landing page only.
2. Replace the manual token-paste field with automatic token management via localStorage.
3. Provide a compelling, high-converting landing page that drives registration.
4. After login/register, users see all their businesses and goals immediately (including `SpeakASAP App`, projectId `44d86491-9927-4665-8fb4-e5a725944e3b`).

---

## Approach: Client-side auth gate (Approach B)

**No NestJS backend changes. No nginx changes.** Pure frontend.

Rationale:
- The existing ecosystem pattern (shop-assistant, etc.) uses localStorage for tokens.
- `auth.alfares.cz` already returns tokens via URL fragment — designed for this flow.
- The dashboard's read data is not a security secret; backend already gates all mutations via JwtGuard.
- Fastest to ship with zero risk to the running backend.

---

## Auth Flow

```
1. User opens orchestrator.alfares.cz
   → app.js runs initAuth()
   → checks URL for #access_token fragment (returning from auth.alfares.cz)
     → if found: store in localStorage, clear fragment from URL
   → reads localStorage.getItem('accessToken')
   → if token present: render dashboard, pre-populate portfolioState.authToken
   → if no token: render landing page

2. User clicks "Get started" or "Sign in" on landing page
   → redirected to auth.alfares.cz/login?return_url=https://orchestrator.alfares.cz/&client_id=business-orchestrator&state=<csrf>
   → authenticates there
   → auth.alfares.cz redirects back to https://orchestrator.alfares.cz/#access_token=...&refresh_token=...
   → step 1 handles the fragment

3. User clicks Logout
   → localStorage cleared
   → landing page rendered
```

---

## Files Changed

### `public/index.html`

- Add `<div id="landing-view" style="display:none">` section containing:
  - Hero: headline, subheadline, two CTA buttons (Register / Sign in)
  - Feature grid: 3 value-prop cards
  - Stats row: "20+ businesses managed", "24/7 autonomous execution", "AI-driven goal tracking"
- Add logout button + user email display to the sidebar (hidden until authenticated)
- Keep all existing dashboard sections unchanged

### `public/app.js`

**New `initAuth()` function** (runs before anything else):
- Parse `window.location.hash` for `access_token`, `refresh_token`, `expires_at`
- If found: `localStorage.setItem('accessToken', ...)`, `localStorage.setItem('refreshToken', ...)`, `localStorage.setItem('user', ...)` — then strip fragment from URL with `history.replaceState`
- Read `localStorage.getItem('accessToken')`
- If token: set `portfolioState.authToken`, call `showDashboard()` → existing `buildActionPanel()` + `loadPortfolio()`
- If no token: call `showLanding()`

**`showLanding()` function**:
- Hide `#portfolio-view`, `#goal-detail-view`, etc. + hide sidebar nav
- Show `#landing-view`

**`showDashboard()` function**:
- Hide `#landing-view`
- Show sidebar nav + `#portfolio-view`
- Run existing init code

**Sidebar updates**:
- Show `<span id="user-email">` with email from localStorage user object
- Show `<button id="logout-btn">` → clears localStorage, calls `showLanding()`

**Token input field**: Hide `#field-auth-token` (the manual paste input) — token is populated automatically from `portfolioState.authToken`.

**Auth URL helper**:
```js
function authUrl(path) {
  const returnUrl = encodeURIComponent(window.location.origin + '/');
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('auth_state', state);
  return `https://auth.alfares.cz${path}?return_url=${returnUrl}&client_id=business-orchestrator&state=${state}`;
}
```

### `public/style.css`

Add styles for:
- `#landing-view` — full-height, centered, dark-to-light gradient background
- `.landing-hero` — large headline (`2.5rem`), subheadline, CTA buttons
- `.landing-features` — 3-column grid, card per feature
- `.landing-stats` — horizontal stats row
- `.btn-landing-primary` — solid blue CTA button
- `.btn-landing-secondary` — ghost/outline CTA button
- `#user-email` — small text in sidebar
- `#logout-btn` — small logout link in sidebar

---

## Landing Page Copy

**Headline:** Run your businesses on autopilot  
**Subheadline:** AI agents manage your projects, goals, and tasks 24/7. You stay in control — agents do the work.

**Features:**
1. **Autonomous AI Agents** — Specialized agents execute tasks, write code, validate results, and escalate only when needed.
2. **Real-time Goal Tracking** — Every goal is broken into milestones. Progress is tracked and reported automatically.
3. **Multi-business Portfolio** — Manage 1 to 50+ businesses from a single dashboard. Each with its own projects and agent pool.

**Stats:** 24/7 uptime · AI-driven execution · Multi-tenant portfolio

**CTA:**  
- Primary: "Get started — it's free" → `/register` on auth.alfares.cz  
- Secondary: "Sign in" → `/login` on auth.alfares.cz

---

## Verification

1. Open `https://orchestrator.alfares.cz/` in an incognito window → landing page appears, dashboard hidden
2. Click "Sign in" → redirected to `auth.alfares.cz/login?return_url=https://orchestrator.alfares.cz/...`
3. Log in with test account → redirected back, dashboard loads with all businesses visible (SpeakASAP App, unknown, projectId `44d86491-...`)
4. Sidebar shows logged-in email + Logout button
5. Click Logout → landing page reappears, localStorage cleared
6. Click "Get started" → redirected to `auth.alfares.cz/register?return_url=...`
7. Confirm mutation actions (create business, etc.) still work without needing to manually enter a token

---

## Out of Scope

- Server-side middleware / httpOnly cookie approach (deferred, can be added later)
- CSRF state validation on callback (state param is set but not validated server-side — acceptable for this iteration)
- Token refresh on expiry (refresh token stored in localStorage; automatic refresh deferred)
