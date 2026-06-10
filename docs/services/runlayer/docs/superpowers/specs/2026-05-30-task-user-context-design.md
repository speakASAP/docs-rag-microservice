# Task User Context & Manual Edit — Design Spec

**Date:** 2026-05-30  
**Status:** Approved  
**Author:** speakASAP

---

## Problem

Users need to annotate tasks with additional context (corrections, clarifications, customer details) at any point in the task lifecycle. These annotations must survive reruns and be visible to the AI on next execution. Users also need to manually edit task fields (`payloadRef`, `acceptanceCriteria`, `priority`, `maxAttempts`) when AI-generated instructions are too short or misleading.

---

## Solution Overview

- Add a `user_context` JSONB column to `tasks` — a thread of timestamped comments plus a distilled summary string for AI injection.
- New `POST /comment` endpoint appends to thread and updates distilled.
- New `PATCH /dashboard/tasks/:id` endpoint for full manual field edits.
- Existing `reject` and `retry` endpoints gain an optional `comment` field.
- Worker prompt builder injects `user_context` as a clearly labelled block when non-empty.
- UI: comment box in task detail drawer, inline comment button on task rows, comment capture on reject/retry flows.

---

## Data Model

### New column on `runlayer.tasks`

```sql
ALTER TABLE runlayer.tasks
ADD COLUMN user_context JSONB NOT NULL DEFAULT '{"distilled":"","thread":[]}';
```

### Shape

```typescript
interface UserContext {
  distilled: string;           // latest summary — what the AI reads
  thread: UserComment[];       // full history — displayed in UI
}

interface UserComment {
  ts: string;                  // ISO 8601
  author: 'user';
  text: string;
}
```

### Persistence rules

- `user_context` is **never cleared** by `reactivateInPlace()`, `retryTask()`, `forceRequeue()`, or `requeueAfterFailure()`.
- On `rejectTask()`: rejection reason is always appended to `thread`; `distilled` is updated to the rejection reason.
- On `retryTask()` with optional comment: comment is appended to `thread` and `distilled` is updated.

### Editable task fields via PATCH

| Field | Type | Validation |
|-------|------|-----------|
| `payloadRef` | `Record<string, any>` | full replace, no size limit |
| `acceptanceCriteria` | `string[]` | max 3 items |
| `priority` | `number` | 1–5 |
| `maxAttempts` | `number` | ≥ 1 |
| `userContextDistilled` | `string` | optional standalone override (no thread entry) |

---

## API Endpoints

### POST /api/dashboard/tasks/:taskId/comment

Append a user comment and update distilled.

**Request body:**
```json
{ "text": "Your comment here" }
```

**Behaviour:**
1. Load task.
2. Append `{ ts: now, author: "user", text }` to `user_context.thread`.
3. Set `user_context.distilled = text`.
4. Save task.
5. Log `task_user_comment_added` to logging service.
6. Emit WebSocket `task:updated` event.
7. Return `DashboardApproveResponseSchema` shape.

**Auth:** `JwtGuard`

---

### PATCH /api/dashboard/tasks/:taskId

Partial update of editable task fields.

**Request body** (all fields optional):
```json
{
  "payloadRef": { ... },
  "acceptanceCriteria": ["criterion 1", "criterion 2"],
  "priority": 2,
  "maxAttempts": 3,
  "userContextDistilled": "override distilled without thread entry"
}
```

**Behaviour:**
1. Load task.
2. Apply only supplied fields.
3. Validate: `acceptanceCriteria.length <= 3`, `priority` in 1–5, `maxAttempts >= 1`.
4. Save task.
5. Log `task_fields_edited` to logging service.
6. Emit WebSocket `task:updated` event.
7. Return updated `DashboardTaskDetailSchema`.

**Auth:** `JwtGuard`

---

### POST /api/dashboard/tasks/:taskId/reject (updated)

Gains optional `comment` field.

**Request body:**
```json
{ "reason": "...", "comment": "optional extra context" }
```

- If `comment` is present (and differs from `reason`), it is appended to the thread in addition to `reason`.
- If `comment` is absent, `reason` is appended to thread as before.

---

### POST /api/dashboard/tasks/:taskId/retry (updated)

Gains optional `comment` field.

**Request body:**
```json
{ "comment": "optional note before retry" }
```

- If present, append to `user_context.thread` and update `distilled` before reactivating.

---

## Worker Agent Injection

### Prompt injection format

When `user_context.distilled` is non-empty, inject the following block at the top of the worker's task prompt (before task instructions):

```
=== USER CONTEXT (read carefully — this overrides vague instructions) ===
{user_context.distilled}

=== PREVIOUS USER COMMENTS ===
[2026-05-30 07:35] user: First comment text...
[2026-05-30 08:12] user: Second comment text...
===
```

If `thread` is empty but `distilled` is set, omit the "PREVIOUS USER COMMENTS" block.

### Implementation location

- Primary: `src/worker/task-router.service.ts` — wherever the worker prompt string is assembled from the task.
- Secondary: any other agent that reads `payloadRef` to build its prompt (grep for `payloadRef` in agent service files).

### Survival guarantee

`reactivateInPlace()` in `tasks.service.ts` must not clear `user_context`. Add explicit preservation alongside the existing `user_rejection_feedback` preservation in `create()`.

---

## TypeScript Changes

### `task.entity.ts`

```typescript
@Column({ name: 'user_context', type: 'jsonb', default: '{"distilled":"","thread":[]}' })
userContext: { distilled: string; thread: Array<{ ts: string; author: string; text: string }> };
```

### `src/dashboard/dto/comment-task.dto.ts` (new)

```typescript
export class CommentTaskDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
```

### `src/dashboard/dto/patch-task.dto.ts` (new)

```typescript
export class PatchTaskDto {
  @IsOptional() payloadRef?: Record<string, any>;
  @IsOptional() @IsArray() @ArrayMaxSize(3) acceptanceCriteria?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(5) priority?: number;
  @IsOptional() @IsInt() @Min(1) maxAttempts?: number;
  @IsOptional() @IsString() userContextDistilled?: string;
}
```

### `src/contracts/http-responses.contract.ts`

Add `userContext` to `DashboardTaskDetailSchema`:

```typescript
userContext: z.object({
  distilled: z.string(),
  thread: z.array(z.object({
    ts: z.string(),
    author: z.string(),
    text: z.string(),
  })),
}).optional(),
```

### `dashboard.controller.ts` — `toTaskDetail()` helper

Add `userContext: t.userContext ?? { distilled: '', thread: [] }` to the returned object so the new field flows through all existing endpoints that call `toTaskDetail()`.

### `src/dashboard/dto/reject-task.dto.ts` (updated)

Add optional `comment` field.

### Migration

New TypeORM migration: `AddUserContextToTasks` — `ALTER TABLE runlayer.tasks ADD COLUMN user_context JSONB NOT NULL DEFAULT '{"distilled":"","thread":[]}'`.

---

## UI Changes

### Task detail drawer (`openTaskDetailDrawer` in `public/app.js`)

1. **User Context section** — displayed above Payload:
   - Shows `user_context.thread` as timestamped list.
   - If `distilled` is set, shows it highlighted as "AI sees this".
   - Text area + "Add comment" button → `POST /comment`.

2. **Edit task fields button** — opens an inline editor panel within the drawer:
   - Tab: JSON editor for `payloadRef` (textarea with JSON validation).
   - Tab: `acceptanceCriteria` (one input per criterion, add/remove).
   - Inline inputs: `priority` (select 1–5), `maxAttempts` (number).
   - "Save changes" → `PATCH /dashboard/tasks/:taskId`.

### Task rows (all task lists)

- Add a `💬` comment icon button next to existing "Details" button on every task row.
- Click → small modal with single textarea + submit → `POST /comment`.
- On success: show toast "Comment saved".

### Reject modal (pending-approval-modal)

- Keep existing `reason` textarea.
- Add checkbox: "Also save as user context comment" (default: checked).
- When checked: `POST /reject` body includes `comment: reason`.

### Retry button

- Split into: `[Retry]` | `[+ Note]`
- `[+ Note]` opens a small textarea modal → on submit, calls `POST /comment` then `POST /retry`.
- `[Retry]` alone works as before (no comment).

---

## Out of Scope

- Multi-author / multi-user comment attribution (solo operator only).
- Comment deletion or editing.
- `user_context` on goals (tasks only).
- Rich text / markdown rendering in comments.
