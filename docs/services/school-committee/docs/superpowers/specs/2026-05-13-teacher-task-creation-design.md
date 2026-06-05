# Teacher Task Creation with AI — Design Spec

**Date:** 2026-05-13  
**Status:** Approved  
**Scope:** school-committee + ai-microservice

---

## Overview

Teachers (role: `teacher | committee | school_staff | admin`) can create volunteer tasks for parents using voice recordings, photos, and videos. An AI agent transcribes the media and reformats it into a structured task. The teacher reviews and approves the draft before it publishes to parents.

---

## 1. Data Flow

```
Teacher (browser)
  → [1] Upload media files (photos, video, audio) → MinIO via BFF → returns fileIds
  → [2] POST /api/tasks/draft  { audioFileId?, videoFileIds[], photoFileIds[], textNote? }
      BFF:
        - fetches audio/video from MinIO as stream
        - POST ai-microservice /voice/transcribe  → transcript string
        - POST ai-microservice /task/draft  { transcript, textNote, language }
          → { title, description, deadline?, priority? }
        - saves Task row with status="draft", createdBy=teacher
        - saves TaskPhoto and TaskVideo rows
        - returns draft
  → [3] Teacher reviews draft on screen, may edit title/description/deadline/priority
  → [4] POST /api/tasks/{id}/publish  { title, description, deadline?, priority? }
      BFF:
        - verifies actor has required role AND is createdBy user
        - updates task status: "draft" → "open"
        - deletes raw audioFileId from MinIO (GDPR — voice is personal data)
        - clears audioFileId from Task row
        - writes audit_event: task.published
        - returns published task
```

---

## 2. Architecture

**Approach:** Synchronous draft-on-submit. Teacher waits ~5-10s on screen while AI processes. No background jobs or polling needed.

**Services involved:**
- `school-committee` — frontend wizard + BFF API endpoints
- `ai-microservice` — existing `POST /voice/transcribe` (Whisper) + new `POST /task/draft` (LiteLLM smart tier)
- MinIO — media storage (photos, videos, audio)

---

## 3. Database Schema Changes

Remove `photoFileId` from `Task`. Add `videoFileId`, `audioFileId`, `rawTranscript`, `aiDraftMeta`. Add `TaskPhoto` and `TaskVideo` join tables.

```prisma
model Task {
  // all existing fields remain except photoFileId which is removed
  // status field gains "draft" as valid value (default stays "open" for direct creates)

  audioFileId   String?  @map("audio_file_id") @db.Uuid
  rawTranscript String?  @map("raw_transcript")
  aiDraftMeta   Json?    @map("ai_draft_meta")   // { modelTier, processedAt }

  photos  TaskPhoto[]
  videos  TaskVideo[]
}

model TaskPhoto {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  fileId    String   @map("file_id") @db.Uuid
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  task Task @relation(fields: [taskId], references: [id])

  @@map("task_photos")
}

model TaskVideo {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  fileId    String   @map("file_id") @db.Uuid
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  task Task @relation(fields: [taskId], references: [id])

  @@map("task_videos")
}
```

**Migration name:** `remove_single_photo_add_task_photos_videos`

---

## 4. API Contracts

### school-committee BFF

```
POST /api/upload/media
  Auth: teacher | committee | school_staff | admin
  Body: multipart/form-data { file: File, type: "photo"|"video"|"audio" }
  Limits: photo 20MB, video 100MB, audio 10MB
  Response: { data: { fileId: string, url: string } }

POST /api/tasks/draft
  Auth: teacher | committee | school_staff | admin
  Body: {
    schoolId: string
    classId?: string
    audioFileId?: string
    videoFileIds?: string[]
    photoFileIds?: string[]
    textNote?: string
  }
  Validation: at least one of audioFileId, videoFileIds, textNote must be present
  Response: {
    data: {
      id: string
      status: "draft"
      title: string
      description: string
      priority: string
      deadline?: string
      rawTranscript?: string
      photos: { id, fileId, sortOrder }[]
      videos: { id, fileId, sortOrder }[]
      audioFileId?: string
    }
  }

POST /api/tasks/{id}/publish
  Auth: teacher | committee | school_staff | admin (must be createdBy user)
  Body: {
    title: string
    description: string
    deadline?: string
    priority?: string
  }
  Response: { data: { id, status: "open", ... } }
```

### ai-microservice (new endpoint)

```
POST /task/draft
  Body: {
    transcript?: string
    textNote?: string
    language?: string    // default "cs"
  }
  Response: {
    title: string
    description: string
    priority: "low" | "normal" | "high"
    deadline?: string    // ISO date if detected in transcript
    modelTier: string
  }
```

---

## 5. ai-microservice Changes

**New module:** `src/task/`

```
src/task/
  task.module.ts
  task.controller.ts
  task.service.ts
  dto/
    task-draft.dto.ts
    task-draft-response.dto.ts
```

**Model tier:** `smart` (Gemini flash, fallback to Ollama via LiteLLM).

**System prompt:**
```
You are a school task assistant. Given a voice transcript and/or text note from a teacher,
extract and reformat into a structured task for parent volunteers.
Output JSON only: { title, description, priority, deadline? }
- title: concise, max 80 chars
- description: clear, actionable, 2-5 sentences
- priority: "low" | "normal" | "high"
- deadline: ISO date string if mentioned, omit otherwise
- Language: match input language (default Czech)
```

**Voice transcription:** Uses existing `POST /voice/transcribe` — no changes to voice module.

---

## 6. Frontend UI Flow

**Route:** `/app/dashboard/tasks/new`

**Step 1 — Media input:**
- Voice recorder (Web Audio API → webm/mp3, auto-uploads on stop)
- Photo upload (multiple, thumbnails, removable)
- Video upload (multiple, thumbnails, removable)
- Optional text note textarea
- "Generate Draft" button — disabled until at least one input present

**Step 2 — Processing:**
- Spinner with status: "Uploading...", "Transcribing...", "Drafting task..."
- Non-interactive, ~5-10s

**Step 3 — Review & approve:**
- Editable title input (AI pre-filled)
- Editable description textarea (AI pre-filled)
- Priority selector (AI pre-filled)
- Deadline date picker (AI pre-filled if detected)
- Photo thumbnails
- Video previews/links
- Collapsed "View transcript" accordion
- Buttons: "Edit & Re-draft" | "Publish Task"

**Step 4 — Confirmation:**
- Success toast, redirect to task detail

**State management:** Local React state for wizard steps. TanStack Query only for the publish mutation.

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Transcription fails | Use textNote only; if absent return 422 |
| AI drafting fails | Draft created with raw transcript as description; teacher sees warning banner |
| Media upload fails | Per-file inline error; retry allowed; Generate Draft stays disabled |
| Teacher leaves mid-wizard | Draft persists in DB; "Resume draft" card shown on dashboard; auto-expires after 7 days |
| Large file | 20MB photo / 100MB video / 10MB audio enforced client + BFF |
| Concurrent publish | BFF checks status="draft" + createdBy match; returns 409 if already published |

---

## 8. Security & GDPR

- All new endpoints enforce role check at BFF boundary
- `POST /api/tasks/{id}/publish` additionally checks `createdBy === currentUser.id`
- Parents never see `status="draft"` tasks — filtered out in `GET /api/tasks` for parent role
- Media stored in MinIO under `school-committee/tasks/{taskId}/` — private, signed URLs (1h expiry)
- Raw audio deleted from MinIO after successful publish (voice is personal data under GDPR)
- `audioFileId` cleared from Task row after publish
- Draft deletion removes all associated MinIO files
- Audit events: `task.draft_created`, `task.published`, `task.draft_deleted`

---

## 9. Migration Notes

- Existing `POST /api/tasks` (direct create) must be updated: replace `photoFileId` body field with `photoFileIds[]`. Tasks created directly (without AI draft) use `status="open"` — no change to existing behavior.
- DB migration must backfill existing tasks: move any existing `photo_file_id` values into a `task_photos` row, then drop the column.

---

## 10. Out of Scope (this iteration)

- Multiple audio recordings per task
- Real-time streaming transcription
- AI confidence scores shown to teacher
- Multi-language UI (Czech only for MVP)
- Push notification to parents on publish
