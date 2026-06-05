# Task 010: Admin Panel

**Status:** blocked_by:007,008,009
**Epic:** EPIC-008 Admin
**Depends on:** 007 (onboarding), 008 (tasks), 009 (feedback)

## Context

The admin panel is the operational control surface for committee members and admins. It covers: user management, role assignment, payment manual confirmation, feedback moderation, expense management, and CSV exports. Every admin action must be audited.

## Objective

Implement the admin panel with protected routes, sidebar navigation, user management, payment manual reconciliation, expense management, and CSV export. All actions require `committee` or `admin` role.

## Relevant docs

- `docs/02-mvp-scope.md` — admin panel included list
- `docs/03-personas-and-roles.md` — admin and committee permissions
- `docs/32-api-rest-contracts.md` — admin endpoints
- `docs/40-security-model.md` — admin security requirements
- `docs/41-gdpr-and-data-protection.md` — export constraints

## Files likely touched

- `app/(admin)/layout.tsx` — admin layout with sidebar, role guard
- `app/(admin)/users/page.tsx` — user list with role management
- `app/(admin)/payments/page.tsx` — payment list + manual confirmation
- `app/(admin)/expenses/page.tsx` — expense CRUD
- `app/(admin)/feedback/page.tsx` — moderation queue (link to task 009)
- `app/(admin)/exports/page.tsx` — CSV export triggers
- `app/api/admin/users/[id]/role/route.ts` — PATCH: assign role (admin only)
- `app/api/admin/payments/[id]/confirm/route.ts` — POST: mark payment paid
- `app/api/admin/expenses/route.ts` — POST: create expense
- `app/api/admin/exports/[type]/route.ts` — GET: generate CSV (payments/tasks/feedback)
- `components/admin/Sidebar.tsx`

## Implementation constraints

- All `/admin/*` routes must verify `admin` or `committee` role at middleware level AND at each API route
- Role assignment endpoint: `admin` role only (not committee), audit logged, no last-admin removal
- Payment confirmation: requires `reference` (bank statement ref), marks record immutable, audit logged
- Corrections to paid payments: require `reason`, audit logged, separate PATCH endpoint
- CSV exports: `admin` only, audit event on every export with: user_id, export_type, record_count, timestamp
- Expense creation: `public_visible` toggle, `category` required, `receipt_url` optional
- User list: filter by role and class, paginated
- No personal payment data in exports without audit trail

## Acceptance criteria

- [ ] Admin sidebar with links to: users, payments, expenses, feedback, exports
- [ ] Sidebar renders only for admin/committee role, redirects others to /dashboard
- [ ] User list: paginated, filterable by role and class
- [ ] Role assignment: admin-only, audit event created, last admin removal blocked
- [ ] Payment confirmation: requires bank reference, marks payment immutable, audit event
- [ ] Expense creation: amount, category, description, public toggle
- [ ] CSV export: payments/tasks/feedback — admin only, audit logged
- [ ] Parent accessing `/admin/*` → redirected to dashboard

## Tests required

- Security test: parent GET /admin → redirect or 403
- Security test: committee cannot assign roles (admin-only)
- Integration test: mark payment paid → status becomes immutable
- Integration test: create expense → appears in DB service
- Integration test: CSV export → audit event created with export_type
- Unit test: last-admin removal blocked

## Do not

- Do not allow committee to assign roles (admin-only operation)
- Do not allow payment record modification after `paid` without correction flow and audit
- Do not include individual payer names in public-facing expense reports
- Do not implement complex BI or external accounting integration
- Do not allow CSV export without audit logging
