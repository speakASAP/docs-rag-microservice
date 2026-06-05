# Task 007: Onboarding Flow

**Status:** blocked_by:002,003
**Epic:** EPIC-003 Onboarding
**Depends on:** 002 (auth), 003 (db-client)

## Context

After a parent registers via auth-microservice and verifies their email, they must complete a domain profile: language, class selection, children count (birth year optional), participation type, and GDPR consent. This is the first domain-specific screen after login.

## Objective

Build the multi-step onboarding flow that completes the parent's domain profile in the DB service. Flow: language selection → profile form → GDPR consent → dashboard redirect.

## Relevant docs

- `docs/02-mvp-scope.md` — registration included/excluded list
- `docs/03-personas-and-roles.md` — parent role permissions
- `docs/04-user-flows.md` — registration and onboarding flow
- `docs/30-domain-model.md` — Profile, Child, Class entities
- `docs/41-gdpr-and-data-protection.md` — consent requirements
- `docs/14-auth-service-contract.md` — registration flow

## Files likely touched

- `app/(onboarding)/language/page.tsx` — step 1: cs/en/ru/uk selection
- `app/(onboarding)/profile/page.tsx` — step 2: name, phone (optional), class, children, participation type
- `app/(onboarding)/consent/page.tsx` — step 3: GDPR consent checkboxes with version
- `app/(onboarding)/layout.tsx` — onboarding layout with step indicator
- `app/api/onboarding/profile/route.ts` — POST: create profile in DB service
- `app/api/onboarding/consent/route.ts` — POST: record consent
- `lib/db/profiles.ts` — createProfile call (from task 003)
- `types/onboarding.ts` — form types

## Implementation constraints

- Language selection must persist to user profile in DB service and to a cookie for i18n
- Phone number is optional — do not mark as required
- Class selection must fetch class list from DB service
- Children: collect count and optionally birth year only — no full child name, no exact birth date (per docs/41)
- Participation type options: `financial`, `labor`, `mixed` (from docs/02)
- GDPR consent: must record `terms_accepted`, `privacy_policy_accepted`, `parent_committee_participation` with version and timestamp
- Profile creation fails if email not verified (check token claim)
- Onboarding status tracked in profile: `pending` → `complete`
- If profile already exists and status is `complete`, redirect to dashboard

## Acceptance criteria

- [ ] Language selection screen shows 4 options (cs/en/ru/uk)
- [ ] Selected language persists and is used for all subsequent screens
- [ ] Profile form validates: first_name required, last_name required, phone optional
- [ ] Class dropdown populated from DB service
- [ ] Children section: count required, birth_year optional, no full child name collected
- [ ] Participation type required (financial/labor/mixed)
- [ ] Consent screen shows terms and privacy policy links
- [ ] Consent recorded with version and timestamp before any profile creation
- [ ] Unverified email: blocked with clear message
- [ ] Completed onboarding: redirect to `/dashboard`
- [ ] Already onboarded user: redirect to `/dashboard` skipping onboarding

## Tests required

- Unit test: consent record includes version, timestamp, all required types
- Unit test: children form rejects full name field (field must not exist)
- Integration test: full onboarding flow POST → profile created in DB service
- Integration test: unverified email POST → 403 with clear error
- Security test: consent form without all required checkboxes → validation fails

## Do not

- Do not collect child full name or exact birth date
- Do not skip GDPR consent step
- Do not allow onboarding without email verification
- Do not store consent only in frontend state — must persist to DB service
- Do not create child accounts (children are linked to parent, not independent users)
