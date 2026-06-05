# Task 008: Task Module

**Status:** blocked_by:002,003
**Epic:** EPIC-004 Tasks
**Depends on:** 002 (auth), 003 (db-client)

## Context

Volunteer tasks are the core non-financial contribution mechanism. Parents claim tasks, complete them, and committee verifies. The critical invariant is atomic claiming — two parents must never both claim the same task. The DB service owns this atomicity.

## Objective

Implement task list, task detail, task claim, and task completion flows. The BFF delegates all data operations to DB service and handles role-based access.

## Relevant docs

- `docs/02-mvp-scope.md` — included/excluded task features
- `docs/15-db-service-contract.md` — atomic task claim endpoint
- `docs/32-api-rest-contracts.md` — task endpoints
- `docs/30-domain-model.md` — Task entity
- `docs/40-security-model.md` — role checks

## Files likely touched

- `app/(app)/tasks/page.tsx` — task list with filters
- `app/(app)/tasks/[id]/page.tsx` — task detail
- `app/api/tasks/route.ts` — GET list with filters
- `app/api/tasks/[id]/route.ts` — GET detail
- `app/api/tasks/[id]/claim/route.ts` — POST: atomic claim
- `app/api/tasks/[id]/complete/route.ts` — POST: submit completion
- `components/tasks/TaskCard.tsx`
- `components/tasks/TaskDetail.tsx`
- `components/tasks/ClaimButton.tsx`
- `lib/db/tasks.ts` — from task 003

## Implementation constraints

- Task list filters: status, class_id, participation_type (per docs/15)
- Claim button shown only when: task status is `open` AND current user has no active claim
- `POST /api/tasks/{id}/claim` calls DB service atomic endpoint — never implements optimistic locking in BFF
- 409 Conflict from DB service → display "Task already claimed" message, refresh task state
- Completion submission: assignee only, proof upload placeholder (file upload not required in this task)
- Committee/admin can verify completion; parent cannot
- All mutations (claim, complete, verify) emit audit events
- Mobile-friendly card layout required

## Acceptance criteria

- [ ] Task list renders with status/class filters
- [ ] Empty state, loading state, error state all handled
- [ ] Task detail shows: title, description, deadline, priority, status, assignee if claimed
- [ ] Claim button visible only when task is open and user is eligible
- [ ] Successful claim: task status updates to `reserved`, button disappears
- [ ] Claim conflict (409): user sees "Task already claimed" and task refreshes
- [ ] Parent cannot see "Verify" button (role-blocked)
- [ ] Committee can verify completion
- [ ] Audit event emitted on claim and on completion submission

## Tests required

- Unit test: task claim conflict → CONFLICT error with TASK_ALREADY_CLAIMED code
- Unit test: verify button hidden for parent role
- Integration test: POST /api/tasks/{id}/claim → 200 on first call
- Integration test: POST /api/tasks/{id}/claim (second call) → 409
- Security test: parent cannot call verify endpoint

## Do not

- Do not implement optimistic locking in BFF — DB service handles atomicity
- Do not show other parent's personal details on the task (show "Claimed" not "Claimed by Jane Doe")
- Do not implement geolocation features
- Do not build marketplace matching or scheduling
- Do not upload files in this task — use placeholder only
