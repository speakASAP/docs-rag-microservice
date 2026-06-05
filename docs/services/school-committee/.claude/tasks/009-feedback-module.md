# Task 009: Feedback Module

**Status:** blocked_by:002,003
**Epic:** EPIC-006 Feedback
**Depends on:** 002 (auth), 003 (db-client)

## Context

Parents, teachers, and staff can submit structured feedback. The key feature is QR-accessible anonymous submission — a public URL that shows only a form, no login required for anonymous feedback. Committee/admin moderate submissions. Anonymous feedback must never reveal the author even to moderators (unless author chose named).

## Objective

Implement the public feedback form (QR-accessible), the authenticated feedback history view, and the moderation queue for committee/admin.

## Relevant docs

- `docs/02-mvp-scope.md` — feedback included/excluded
- `docs/30-domain-model.md` — Feedback entity
- `docs/32-api-rest-contracts.md` — feedback endpoints
- `docs/40-security-model.md` — public endpoint controls, anonymous protection
- `docs/41-gdpr-and-data-protection.md` — anonymous feedback, GDPR

## Files likely touched

- `app/feedback/page.tsx` — public feedback form (no auth required)
- `app/(app)/feedback/page.tsx` — authenticated feedback history
- `app/(admin)/feedback/page.tsx` — moderation queue
- `app/api/feedback/route.ts` — POST: submit (public + auth), GET: list (auth only)
- `app/api/feedback/[id]/route.ts` — PATCH: moderate status (admin/committee only)
- `components/feedback/FeedbackForm.tsx`
- `components/feedback/ModerationQueue.tsx`

## Implementation constraints

- Public form (`/feedback`) must work without authentication
- Anonymous toggle: when enabled, `submitter_user_id` must NOT be stored or recoverable
- Rate limit on public submission: 5/hour/IP (per docs/13)
- Category required: select from predefined list
- Class: optional or required per school config
- Type required (suggestion/issue/question/other from docs domain model)
- Status flow: `submitted` → `in_review` → `resolved` / `archived`
- Moderation queue visible to committee and admin only
- `anonymous: true` submissions: API must never return `submitter_user_id` even in admin view
- All feedback submissions emit audit event (with user_id omitted if anonymous)

## Acceptance criteria

- [ ] `/feedback` accessible without login
- [ ] Form fields: category (required), class (optional), type (required), anonymous toggle, text (required)
- [ ] Anonymous submission: no user identity stored, form still works
- [ ] Named submission: user_id linked (authenticated users only)
- [ ] Rate limiting on public form (5/hour/IP)
- [ ] Submission success screen shown after submit
- [ ] Moderation queue shows feedback list with status and category
- [ ] Status update (in_review/resolved/archived) available to committee/admin
- [ ] Anonymous feedback: `submitter` field absent/null in API response for all roles
- [ ] Parent cannot access moderation queue

## Tests required

- Unit test: anonymous submission does not store user_id
- Integration test: public POST /api/feedback → 200, no auth required
- Integration test: POST /api/feedback rate limit → 429 after 5 requests
- Security test: parent GET /api/feedback/moderation → 403
- Security test: anonymous feedback → admin GET /api/feedback/{id} → no submitter field

## Do not

- Do not require login for public feedback form
- Do not store author identity for anonymous submissions
- Do not expose anonymous author to any role including admin
- Do not implement voice messages or speech-to-text (excluded from MVP)
- Do not allow public comments on feedback (excluded from MVP)
