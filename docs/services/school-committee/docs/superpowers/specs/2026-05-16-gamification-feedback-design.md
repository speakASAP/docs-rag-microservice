# Design Spec: Gamification + Ideas Board

**Date:** 2026-05-16  
**Status:** Approved

---

## Context

The platform needs higher parent engagement. Adding a public ideas board with voting, threaded comments, media attachments, and a gamification layer (badges, Hall of Fame, profile pages) creates positive reinforcement loops that reward participation. The existing private `/feedback` flow is unchanged. The existing `Idea` and `IdeaVote` models in the schema provide a starting point.

---

## 1. Database Schema Changes

### Extend `Idea` model (additions only)

```prisma
isAnonymous     Boolean  @default(false) @map("is_anonymous")
voiceFileKey    String?  @map("voice_file_key")
voiceTranscript String?  @map("voice_transcript")
updatedAt       DateTime @default(now()) @updatedAt @map("updated_at")
```

Relations to add: `photos IdeaPhoto[]`, `videos IdeaVideo[]`, `comments IdeaComment[]`

### New models

```prisma
model IdeaPhoto {
  id        String   @id @default(uuid()) @db.Uuid
  ideaId    String   @map("idea_id") @db.Uuid
  fileId    String   @map("file_id") @db.Uuid
  fileExt   String   @default("jpg") @map("file_ext")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  idea      Idea     @relation(fields: [ideaId], references: [id])
  @@map("idea_photos")
}

model IdeaVideo {
  id        String   @id @default(uuid()) @db.Uuid
  ideaId    String   @map("idea_id") @db.Uuid
  fileId    String   @map("file_id") @db.Uuid
  fileExt   String   @default("mp4") @map("file_ext")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  idea      Idea     @relation(fields: [ideaId], references: [id])
  @@map("idea_videos")
}

model IdeaComment {
  id        String   @id @default(uuid()) @db.Uuid
  ideaId    String   @map("idea_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  body      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
  idea      Idea     @relation(fields: [ideaId], references: [id])
  likes     IdeaCommentLike[]
  @@map("idea_comments")
}

model IdeaCommentLike {
  id        String   @id @default(uuid()) @db.Uuid
  commentId String   @map("comment_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  comment   IdeaComment @relation(fields: [commentId], references: [id])
  @@unique([commentId, userId])
  @@map("idea_comment_likes")
}

model Achievement {
  id          String   @id @default(uuid()) @db.Uuid
  key         String   @unique
  labelCs     String   @map("label_cs")
  labelEn     String   @map("label_en")
  descriptionCs String? @map("description_cs")
  tier        String   -- bronze | silver | gold
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("achievements")
}

model UserAchievement {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  achievementKey String   @map("achievement_key")
  awardedAt      DateTime @default(now()) @map("awarded_at")
  metadata       Json     @default("{}")
  @@unique([userId, achievementKey])
  @@map("user_achievements")
}
```

`IdeaVote` already has `@@unique([ideaId, userId])` — no changes needed.

---

## 2. Ideas Board (`/ideas`)

### Routes

| Path | Access | Purpose |
|------|--------|---------|
| `/ideas` | Public | List all ideas, sorted by vote count desc |
| `/ideas/[id]` | Public list; comments auth-only | Idea detail + media + comments |
| `/api/ideas` POST | Auth | Create idea |
| `/api/ideas` GET | Public | List ideas (paginated, cursor-based) |
| `/api/ideas/[id]` GET | Public | Get idea detail with vote count |
| `/api/ideas/[id]` DELETE | school_staff / admin | Soft-delete idea (set status='deleted') |
| `/api/ideas/[id]/vote` POST | Auth | Toggle upvote (insert/delete IdeaVote) |
| `/api/ideas/[id]/comments` GET | Auth | List comments with like counts |
| `/api/ideas/[id]/comments` POST | Auth | Add comment |
| `/api/ideas/[id]/comments/[cid]/like` POST | Auth | Toggle comment like |
| `/api/storage/upload-url/media` | Existing | Reuse for idea photos/videos |

### Visibility rules

| Viewer | Author name shown |
|--------|-----------------|
| Unauthenticated | Never (show "Anonymní" regardless of isAnonymous) |
| Authenticated + idea isAnonymous=true | "Anonymní" |
| Authenticated + idea isAnonymous=false | Full name (firstName + lastName) |

### Voting rules

- Author cannot vote on their own idea (BFF enforces, UI hides button).
- Toggle: POST to `/api/ideas/[id]/vote` inserts or deletes the IdeaVote row.
- Vote count = `_count.votes` from Prisma.
- After vote: call `awardBadgesForUser(voterId)`.

### Idea creation wizard

Reuses existing components:
- `MediaUploader` from `components/tasks/MediaUploader.tsx`
- `VoiceRecorder` from `components/tasks/VoiceRecorder.tsx`

Steps: (1) title + description + media, (2) anonymous toggle, (3) confirm.  
Storage keys: `ideas/photos/{uuid}.{ext}`, `ideas/videos/{uuid}.{ext}`, `ideas/audio/{uuid}.wav`.  
Transcription via existing `lib/ai/transcribe.ts`.

### Comment rules

- Any authenticated user can comment (including anonymous idea author — they are still authenticated).
- Comments always attributed (no anonymous comments).
- Comment likes: any authenticated user except the commenter can like.
- Public / unauthenticated visitors: see comment count on list page; on detail page show "Přihlaste se pro zobrazení diskuse".

---

## 3. Gamification

### Badge definitions (seed data)

| Key | Tier | Award condition |
|-----|------|----------------|
| `registered` | Bronze | First profile save (onboarding) |
| `profile_complete` | Bronze | firstName, lastName, phone all set + ≥1 child |
| `child_added` | Bronze | First child record created |
| `role_committee` | Gold | Has active `committee` role |
| `role_teacher` | Silver | Has active `teacher` role |
| `idea_first` | Bronze | Posted ≥1 idea |
| `idea_5` | Silver | Posted ≥5 ideas |
| `idea_20` | Gold | Posted ≥20 ideas |
| `voter_first` | Bronze | Cast ≥1 vote |
| `voter_10` | Silver | Cast ≥10 votes |
| `voter_50` | Gold | Cast ≥50 votes |
| `comment_first` | Bronze | Left ≥1 comment |
| `comment_10` | Silver | Left ≥10 comments |
| `popular_idea_10` | Silver | Any of user's ideas has ≥10 votes |
| `popular_idea_50` | Gold | Any of user's ideas has ≥50 votes |
| `task_completed` | Bronze | Completed ≥1 task |
| `task_champion_5` | Silver | Completed ≥5 tasks |
| `task_champion_20` | Gold | Completed ≥20 tasks |
| `best_commenter` | Gold | Highest total comment likes among all users (competitive, reassigned) |
| `early_adopter` | Bronze | Registered within 30 days of school year start (Sept 1) |

**Tier point values:** Gold=3, Silver=2, Bronze=1. Hall of Fame score = sum of points.

### Badge award engine

File: `lib/gamification/award-badges.ts`

```typescript
export async function awardBadgesForUser(userId: string, prisma: PrismaClient): Promise<void>
```

- Runs all non-competitive badge checks in parallel (`Promise.all`).
- For each badge earned and not yet in `UserAchievement`: insert row.
- `best_commenter`: query top user by comment like count; if different from current holder, delete old holder's row and insert new one.
- Called at end of: idea create, vote toggle, comment create, comment like toggle, task complete/verify, profile save, child add, role assign.

### Scoring helper

```typescript
export function calcUserScore(achievements: UserAchievement[]): number
// Gold * 3 + Silver * 2 + Bronze * 1
```

---

## 4. Hall of Fame (`/hall-of-fame`)

- Route: `/app/(app)/hall-of-fame/page.tsx` — authenticated only.
- API: `GET /api/hall-of-fame` — returns top 20 users sorted by score desc.
  - Joins `UserAchievement` → `Achievement` for tier, counts per tier, calculates score.
  - Joins `Profile` for name.
- Display: rank badge (1st/2nd/3rd highlighted), full name, total score, badge icon row (grouped by tier).
- Clicking a user → `/profil/[userId]`.
- Nav link: shown in authenticated header only.

---

## 5. User Profile Pages

### Routes

| Path | Access | Purpose |
|------|--------|---------|
| `/profil/[userId]` | Auth | View any user's public profile |
| `/profil/muj` | Auth | Redirect to own `/profil/[userId]` |
| `/api/profile/[userId]` GET | Auth | Profile data: name, roles, badges, stats |

### Profile data shown

- First name + last name, join date.
- Active roles (committee member, teacher, school_staff, admin).
- All earned badges (icon + label + tier colour).
- Stats: ideas posted (excluding anonymous), votes cast, comments made, tasks completed.
- Does NOT show: email, phone, payment data, children details.

### Linking

- Ideas board: clicking author name (when visible) → `/profil/[userId]`.
- Hall of Fame: each row → `/profil/[userId]`.
- Own profile: account dropdown → "Můj profil".

---

## 6. Admin Section

### `/admin/ideas`

- List all ideas (including deleted) with columns: title, author name, vote count, comment count, status, created date.
- Delete button: soft-delete (set `status='deleted'`), cascade-deletes media S3 objects via background job or immediate API call.
- Filter: by status (active / deleted).

---

## 7. API Patterns

Follow existing conventions:
- Cursor-based pagination (`nextCursor` UUID or null).
- `AppError` with `code`, `message`, `statusCode`.
- Every mutation writes to `AuditLog` in the same transaction.
- Every request propagates `request_id`.
- Auth via existing middleware at `/middleware.ts`.

---

## 8. Verification

1. **Schema migration:** `npx prisma migrate dev` runs without errors.
2. **Ideas board — public:** visit `/ideas` unauthenticated → see ideas, no names shown.
3. **Ideas board — authenticated:** log in → see names (unless anonymous), vote button active (not own idea), comment section visible.
4. **Create idea:** log in → create idea with photo + voice → appears on `/ideas` immediately.
5. **Anonymous idea:** create with anonymous toggle → name shows as "Anonymní" for all viewers.
6. **Vote badge:** cast first vote → check `user_achievements` table for `voter_first` row.
7. **Hall of Fame:** `/hall-of-fame` returns 200, shows ranked list with badge icons.
8. **Profile page:** `/profil/[userId]` shows correct badges and stats.
9. **Admin delete:** staff deletes idea → idea disappears from public list.
10. **best_commenter:** seed data with likes, verify badge reassigns to top user.
