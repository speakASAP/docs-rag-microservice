# User Onboarding & Approval Workflow — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

---

## Context

The current onboarding flow (language → profile → consent → set-password) immediately grants users full access after completing GDPR consent. There is no way for school staff to verify that a registering parent is a real parent of a child at the school, or that a person claiming to be a teacher/staff member is legitimate. Every user must now be manually approved by school_staff before gaining access to any mutating actions in the app.

---

## Goals

1. After completing onboarding, every user enters a **pending approval** state.
2. School staff reviews pending users in an admin approval dashboard.
3. Staff approves or rejects with a reason; rejected users can edit and resubmit.
4. Parents bind their children (name + class) during onboarding; staff confirms this link on approval.
5. Teachers and school_staff self-identify post-registration and request a role upgrade; staff approves via the same dashboard.

---

## Data Model Changes

### Profile table — new fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `approvalStatus` | enum | `pending` | `pending \| approved \| rejected` |
| `approvedBy` | UUID? | null | userId of approving school_staff |
| `approvedAt` | DateTime? | null | timestamp of approval |
| `rejectionReason` | String? | null | shown to user on rejection |

Remove `childrenCount` int from Profile (replaced by proper Child records).

### Child table — update

The existing `Child` model is used. Ensure these fields exist:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `parentId` | UUID | → Profile.userId |
| `firstName` | String | required |
| `lastName` | String | required |
| `classId` | UUID | → Class.id |
| `notes` | String? | optional free-text |

### New table: RoleUpgradeRequest

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | requesting user |
| `requestedRole` | String | `teacher \| school_staff` |
| `reason` | String? | optional justification |
| `status` | enum | `pending \| approved \| rejected` |
| `reviewedBy` | UUID? | school_staff who reviewed |
| `reviewedAt` | DateTime? | |
| `rejectionReason` | String? | |
| `createdAt` | DateTime | |

---

## Onboarding Flow Changes

**Updated step order:**

1. Language selection (unchanged)
2. Profile form — firstName, lastName, phone (remove childrenCount)
3. **Children step (NEW)** — dynamic form
4. Consent (unchanged)
5. Set password (unchanged)
6. → dashboard (with pending approval state)

### Step 3 — Children

- Parent adds 1–N children using an "Add child" button
- Per child: firstName (required), lastName (required), classId (dropdown, required), notes (optional)
- Classes fetched from `GET /api/public/classes?schoolId={schoolId}`
- A parent must add at least one child to proceed
- Saved via `POST /api/onboarding/children` — creates Child records linked to parent

### Consent completion (step 4 API change)

`POST /api/onboarding/consent` now sets:
- `onboardingStatus = "complete"`
- `approvalStatus = "pending"` (was implicit "approved" before)

After consent, fires notification to school_staff via notifications microservice:
```
POST NOTIFICATION_SERVICE_BASE_URL/api/notifications
{
  "type": "new_user_pending_approval",
  "recipientRole": "school_staff",
  "payload": { "userId": "...", "name": "...", "email": "..." }
}
```

---

## Server-Side Enforcement

Every mutating API route checks `approvalStatus === "approved"` in addition to role checks. If not approved, return:

```json
{ "error": { "code": "ACCOUNT_PENDING_APPROVAL", "message": "Your account is awaiting approval." } }
```

HTTP status: `403`.

Read-only routes (GET) do not check approval status — user can browse.

**Middleware does NOT lock the dashboard.** The `approvalStatus` check lives in the API layer only.

### Rejected user UX

- A rejected user hits 403 on any action
- The `GET /api/auth/me` response includes `approvalStatus` and `rejectionReason`
- Frontend renders a dismissable banner on the dashboard: "Your registration was not approved: [reason]. [Edit profile]"
- Editing profile and saving resets `approvalStatus = "pending"` and re-notifies staff

---

## Admin Approval Dashboard

### New page: `/admin/approvals`

Added to admin sidebar with a badge showing pending count.

**Tabs:**
- **Pending** — users with `approvalStatus = "pending"`
- **Role Requests** — pending `RoleUpgradeRequest` records
- **All** — full user list (replaces or supplements `/admin/users`)

**Pending tab — table columns:**
`Name | Email | Registered | Children | Actions (Approve / Reject)`

**Detail modal (click a row):**
- User: full name, email, registration date
- Children: list with firstName, lastName, class name, notes
- Approve button → confirm → approve
- Reject button → modal prompts for rejection reason → reject

**Approve action (API: `POST /api/admin/approvals/{userId}/approve`):**
1. Set `approvalStatus = "approved"`, `approvedBy`, `approvedAt`
2. Assign `parent` role via `UserRole` (using existing role assignment logic)
3. Write audit event: `user_approved`
4. Send email to user via notifications service

**Reject action (API: `POST /api/admin/approvals/{userId}/reject`):**
1. Set `approvalStatus = "rejected"`, `rejectionReason`
2. Write audit event: `user_rejected`
3. Send email to user with rejection reason

### Role Requests tab

Lists pending `RoleUpgradeRequest` records.

**Columns:** `Name | Email | Requested Role | Reason | Date | Actions`

**Approve:** assigns the requested role via `UserRole`, sets request `status = "approved"`.
**Reject:** sets request `status = "rejected"`, stores reason, emails user.

---

## Role Upgrade Request Flow (post-approval)

An approved parent sees a "Request role upgrade" option in their profile settings page.

- A modal lets them select: Teacher | School Staff
- Optional reason field
- Submits `POST /api/profile/role-upgrade-request`
- Creates `RoleUpgradeRequest` record with `status = "pending"`
- Notifies school_staff via notifications service

---

## API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/onboarding/children` | authenticated | Save children during onboarding |
| GET | `/api/public/classes` | public | Fetch class list for dropdown |
| POST | `/api/admin/approvals/{userId}/approve` | school_staff | Approve user |
| POST | `/api/admin/approvals/{userId}/reject` | school_staff | Reject user |
| GET | `/api/admin/approvals` | school_staff | List pending approvals |
| POST | `/api/profile/role-upgrade-request` | approved user | Request role upgrade |
| GET | `/api/admin/role-requests` | school_staff | List role upgrade requests |
| POST | `/api/admin/role-requests/{id}/approve` | school_staff | Approve role upgrade |
| POST | `/api/admin/role-requests/{id}/reject` | school_staff | Reject role upgrade |

All admin routes use the existing `requireRole(user, ['school_staff', 'admin'])` utility.

---

## Audit Events

Every approval/rejection writes to `audit_events` in the same transaction:

| Event | Actor | Target |
|---|---|---|
| `user_approved` | school_staff | userId |
| `user_rejected` | school_staff | userId |
| `role_upgrade_approved` | school_staff | userId |
| `role_upgrade_rejected` | school_staff | userId |
| `role_upgrade_requested` | user | userId |
| `profile_resubmitted` | user | userId |

---

## Critical Files to Modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `approvalStatus`, `approvedBy`, `approvedAt`, `rejectionReason` to Profile; update Child model; add `RoleUpgradeRequest` table |
| `middleware.ts` | No change needed (enforcement stays in API layer) |
| `app/api/onboarding/consent/route.ts` | Set `approvalStatus = "pending"` on completion; fire notification |
| `app/api/onboarding/children/route.ts` | New route — create Child records |
| `app/(onboarding)/children/page.tsx` | New page — children form step |
| `app/(onboarding)/profile/page.tsx` | Remove `childrenCount`, update next step to `/onboarding/children` |
| `app/api/admin/approvals/route.ts` | New — list pending approvals |
| `app/api/admin/approvals/[userId]/approve/route.ts` | New — approve user |
| `app/api/admin/approvals/[userId]/reject/route.ts` | New — reject user |
| `app/admin/approvals/page.tsx` | New — approval dashboard page |
| `app/admin/layout.tsx` | Add "Approvals" nav link with badge |
| `app/api/profile/role-upgrade-request/route.ts` | New — submit role upgrade request |
| `app/api/admin/role-requests/route.ts` | New — list role requests |
| `app/api/admin/role-requests/[id]/approve/route.ts` | New — approve role request |
| `app/api/admin/role-requests/[id]/reject/route.ts` | New — reject role request |
| `lib/db/profiles.ts` | Add approval query helpers |
| `lib/auth/get-current-user.ts` | Include `approvalStatus` and `rejectionReason` in returned user object |
| All mutating API routes | Add `approvalStatus === "approved"` guard — specifically: task join/leave, payment submission, idea submission, expense creation, feedback submission, volunteer sign-up |

---

## Verification

1. Register a new user via magic link
2. Complete all onboarding steps including adding children
3. After consent: verify `approvalStatus = "pending"` in DB
4. Attempt a mutating action → expect 403 with `ACCOUNT_PENDING_APPROVAL`
5. Log in as school_staff → visit `/admin/approvals` → see user in pending list
6. Approve the user → verify `approvalStatus = "approved"`, `parent` role assigned, audit event written
7. User can now perform mutating actions
8. Repeat with rejection: verify rejection reason banner appears for rejected user
9. Rejected user edits profile → verify `approvalStatus` resets to `pending`
10. Approved parent requests teacher role upgrade → appears in Role Requests tab → approve → verify role assigned
