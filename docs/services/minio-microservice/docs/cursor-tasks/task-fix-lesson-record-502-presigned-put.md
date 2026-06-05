# Task: fix recurring 502 on lesson record upload by switching to browser → MinIO presigned PUT

## Context

Teachers on `https://speakasap.com/teacher/students/<id>/lessons/<uuid>/` regularly hit `502 Bad Gateway` when uploading lesson recordings (~30 MB MP3) and only succeed after 2–4 retries. Yesterday and today again.

### Confirmed root cause (from production logs, do not re-investigate)

Upload chain today:

```
browser → speakasap nginx → gunicorn (Django 1.11 / Py3.4) → requests.post(127.0.0.1:5051, timeout=60)
       → records_s3_helper.py (boto3, read_timeout=60) → https://minio.alfares.cz → MinIO pod
```

Evidence in `~/speakasap-portal/logs/` on `ssh speakasap`:

- `records_s3_helper.log`: 4× PUTs of the SAME key `2026/05/07/lesson_b12afe53-….mp3` between 16:32 and 16:35; first one took 213 s.
- `app.log`: 4× `Record upload` entries for the same lesson_uuid by the same teacher.
- `/var/log/nginx/error.log`: 3× `upstream prematurely closed connection while reading response header from upstream` for `POST /teacher/students/206621/lessons/b12afe53-…/`.
- Yesterday: `botocore.exceptions.ConnectTimeoutError: Connect timeout on endpoint URL: "https://minio.alfares.cz/..."`.

Boto3 PUT 30 MB to `https://minio.alfares.cz` from speakasap right now: ~2.4 MB/s — any short network slowness pushes the chain over 60 s and gunicorn drops, nginx returns 502, but the file actually does land in MinIO. Teachers retry → duplicate writes.

### Why the current architecture is broken

Three stacked 60 s timeouts (nginx → gunicorn → boto3) on a synchronous chain that has the portal as a useless middleman for tens of MB. A single slow link kills every upload of large files.

## Goal

Move bytes off the portal critical path. Browser uploads MP3 directly to MinIO via S3 **presigned PUT**, then notifies the portal. Portal never reads or relays bytes.

```
browser ──(PUT presigned URL, large MP3)──> https://minio.alfares.cz (K8s ingress → minio-microservice pod)
browser ──(POST tiny JSON, key+ETag+filename)──> speakasap.com → portal saves LessonRecord
```

The portal only ever handles a tiny JSON request, so 502 from upload duration becomes impossible.

## Current deployment (relevant facts)

- Everything is on Kubernetes. `minio-microservice/k8s/{deployment,service,ingress,configmap,secret.yaml.example}.yaml` is the source of truth.
- `ingress.yaml` already routes `minio.alfares.cz` → service `minio-microservice:9000` via `ingressClassName: nginx`, with cert-manager.
- Bucket: `RECORDS_BUCKET` (`speakasap-records`). Key format: `YYYY/MM/DD/lesson_<lesson_uuid>.mp3` and `parts_<part_uuid>.<ext>`.
- speakasap-portal is the **only** service NOT on alfares: it lives on `ssh speakasap` (Django 1.11.2 + Python 3.4 + React 15.4.2). Read `speakasap-portal/CLAUDE.md` and `AGENTS.md`. **DO NOT** upgrade Django/Python.

## Required changes

### 1. minio-microservice — enable browser preflight and PUT against the bucket

#### 1.1 Bucket CORS (mandatory; nginx `add_header` is not enough — S3 OPTIONS preflight must be answered by MinIO itself)

A helper `scripts/set-bucket-cors.sh` already exists in this repo. It reads `RECORDS_CORS_ORIGINS` from `.env` (defaults to `https://speakasap.com,https://www.speakasap.com`) and applies a `CORSConfiguration` to the bucket allowing `GET, PUT, HEAD, OPTIONS` and exposing `ETag`.

Tasks:

- Verify `scripts/set-bucket-cors.sh` works with the K8s deployment. The MinIO pod is internal; either:
  - Run from a pod sidecar / one-shot Job that has `minio-mc` and `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` mounted from the existing secret, OR
  - Run from any host with `kubectl exec` into the minio pod and use the in-pod `mc` binary.
- Wire it into the deploy flow: add a post-deploy step (a `kubectl` command in `scripts/deploy.sh` if a deploy script exists for K8s, or a Kubernetes `Job` manifest under `k8s/cors-job.yaml` that runs after rollout) so CORS is reapplied on every deploy and is idempotent.
- Add `RECORDS_CORS_ORIGINS` to `k8s/configmap.yaml` (non-secret) with the default value above. Document override in `README.md`.

Acceptance: from any HTTPS origin in the allow list, browser `OPTIONS https://minio.alfares.cz/speakasap-records/<key>` with `Access-Control-Request-Method: PUT` and `Access-Control-Request-Headers: content-type` returns 200 with the matching `Access-Control-Allow-*` headers. From a non-allowed origin it does not return them.

#### 1.2 Ingress — confirm `proxy-body-size` and `proxy-request-buffering`

`k8s/ingress.yaml` already sets `proxy-body-size: 100m`. Verify lesson MP3 limit on portal side is ≤ that (it is: `MAX_RECORD_SIZE = 60 MB`). Also add:

```yaml
nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
```

so the ingress does not buffer the whole 60 MB to disk before forwarding to MinIO.

Do **not** add a separate per-host CORS annotation on the ingress — bucket CORS handles the S3 path correctly. A duplicate `Access-Control-Allow-Origin` from ingress can collide with MinIO's own header.

### 2. speakasap-portal — two new tiny JSON endpoints + frontend swap

Repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal` (deploys to `ssh speakasap` server, NOT alfares).

#### 2.1 Backend (Django 1.11 / Python 3.4 — no f-strings, no `pathlib`, no `dataclasses`)

Add two endpoints under the existing teacher cabinet, both authenticated as the lesson's teacher (reuse `@teacher_required` from `employees.utils`):

1. `POST /teacher/students/<student_pk>/lessons/<lesson_uuid>/record/presign/`

   Body (JSON): `{ "filename": "<original.mp3>", "size": <bytes>, "content_type": "audio/mpeg", "kind": "lesson" | "part" }`

   Validate:
   - Lesson belongs to this teacher and student.
   - `size <= MAX_RECORD_SIZE` (60 MB).
   - `content_type` starts with `audio/`.
   - `kind == "lesson"` (single file) or `kind == "part"` (multi-part).

   Compute key the SAME way as `record_upload_name` / `record_part_upload_name`:
   - Lesson: `YYYY/MM/DD/lesson_<lesson.uuid>.mp3` (date from `lesson.start` localtime, fallback `now()`).
   - Part: `YYYY/MM/DD/parts_<new_uuid>.<ext>` — generate the part UUID server-side, return it.

   Generate presigned URL using the existing boto3 client with SigV4 path style (mirror `portal/utils/records_storage.py::_s3_client`). Expiry 900 s.

   Response (JSON):

   ```json
   {
     "method": "PUT",
     "url": "https://minio.alfares.cz/speakasap-records/2026/05/07/lesson_<uuid>.mp3?X-Amz-Algorithm=...",
     "key": "2026/05/07/lesson_<uuid>.mp3",
     "headers": { "Content-Type": "audio/mpeg" },
     "part_uuid": null            // set only when kind=="part"
   }
   ```

2. `POST /teacher/students/<student_pk>/lessons/<lesson_uuid>/record/commit/`

   Body (JSON):

   ```json
   {
     "record_unavailable": "",
     "items": [
       { "kind": "lesson", "key": "...", "size": 12345, "etag": "abc", "filename": "x.mp3" }
     ]
   }
   ```

   or for parts:

   ```json
   { "items": [{ "kind": "part", "part_uuid": "...", "key": "...", "size": ..., "etag": "..." }, ...] }
   ```

   Validate:
   - The submitted keys match the path the server would have generated for this lesson (re-derive and compare; reject if a teacher tries to commit someone else's key).
   - `HEAD` each key against MinIO using boto3 to confirm size and ETag (cheap; no bytes). Reject on mismatch.

   Then perform the same DB work as `RecordForm.save()` does today, but bypass the form's file path:
   - `kind=="lesson"` (1 item): `LessonRecord.update_record(key)` (key already starts with `YYYY/MM/DD/lesson_…`); `processed=True`.
   - `kind=="part"` (≥1): create `LessonRecordPart` rows with the given `part_uuid` and `part_file = key`; populate `LessonRecord.parts` and `processed=False`. `LessonRecord.save()` triggers the existing `merge_records` Celery task; its part download must use S3 (it already does via `records_fs`, leave it alone).
   - Save `record_unavailable` and update `LessonSalaryExpense` / notification queueing exactly like the current view (extract the post-save logic in `cabinet/teacher/views/lessons.py::LessonViewBase.post` into a helper called by both old and new path during the rollout).

   Return `200 {"status":"ok","lesson_record_uuid": "..."}`.

   On error return `4xx` with `{"error":"...","detail":"..."}`. Log with the existing `Record upload:` log line plus `via=presigned`.

   Routes go in `cabinet/teacher/urls.py` (next to `teacher_lesson_view`). Names: `teacher_lesson_record_presign`, `teacher_lesson_record_commit`. CSRF-enforced; the React form already includes the CSRF token.

#### 2.2 Frontend (the lesson page form)

File: `cabinet/templates/teacher/lesson/finish_form.html`. The form today is a multipart `<form>` with `name="record_files"` inputs and a hidden `<input name="record" value="1">`. Change behavior:

- When the teacher clicks the submit button:
  1. For each selected file, `POST /…/record/presign/` to get the presigned URL (kind=`lesson` if exactly one file, kind=`part` for each when multiple).
  2. `fetch(url, { method: 'PUT', headers: {'Content-Type': 'audio/mpeg'}, body: file })` directly to MinIO. Show per-file progress using `XMLHttpRequest` with `upload.onprogress` (vanilla JS — keep this in plain script, no React rewrite; the rest of the page already mixes plain templates with isolated React widgets).
  3. After all PUTs succeed, gather `{key, etag, size, kind, part_uuid?}` for each, then `POST /…/record/commit/` with the items + `record_unavailable` + `recommendation` + `to_manager` (commit must also persist the textarea fields and run the `FinishLessonForm` save). Easiest: keep the existing form fields, but when there are files attached, intercept the submit, do the PUTs first, replace the file inputs with hidden `<input name="record_items_json">`, then submit via `fetch()` to commit and redirect on success.
  4. If any PUT fails: do **not** call commit, surface the error inline.
  5. If `record_unavailable` is filled and no files: skip the presign+PUT phase and just call commit with `items: []`.

- Keep the legacy multipart form path as a feature-flag fallback. Add a Django setting `RECORDS_USE_PRESIGNED_PUT` (default `True`) so we can disable the new path without redeploying frontend if MinIO CORS misbehaves. When the flag is off, the form posts the old way to `/teacher/students/.../lessons/.../`.

#### 2.3 Settings & .env

- Reuse existing `RECORDS_S3_*` settings. No new portal env vars needed unless `RECORDS_USE_PRESIGNED_PUT` is exposed as env.
- `RECORDS_S3_HELPER_URL` and the helper itself stay running for **playback** only (`GET /download` route). Keep `records_s3_helper.ini` supervisord program; do not remove it. Once the new upload path is verified, a follow-up task can switch playback to direct presigned GET too — out of scope here.

#### 2.4 Cleanup that must NOT happen in this task

- Do not delete `records_s3_helper.py` upload route.
- Do not change `RecordsS3Storage._save` — it stays as the helper-based path used by other code (e.g. Celery merge writing the merged file back).
- Do not increase any timeout anywhere. The whole point is removing the 60-second window.

### 3. Verification

On `ssh speakasap` (portal) and from a teacher account on staging or live:

1. CORS preflight from a browser tab on `https://speakasap.com`:

   ```js
   fetch('https://minio.alfares.cz/speakasap-records/_cors_probe', {method:'OPTIONS'})
   ```

   should not throw and should return CORS headers. Inspect the network tab.

2. Upload a 30 MB MP3 from the lesson page. Expected:
   - One `POST …/record/presign/` request → 200 with URL.
   - One `PUT https://minio.alfares.cz/...` request → 200, ETag present.
   - One `POST …/record/commit/` request → 200.
   - No 502s. End-to-end < 15 s on a normal connection.

3. Upload a 60 MB file → succeeds. Upload a 61 MB file → server-side 4xx from presign with size validation; browser shows error.

4. Multi-part: select 2 files → 2 presigns, 2 PUTs, 1 commit. The existing `merge_records` Celery task picks up the parts and writes the merged `lesson_<uuid>.mp3`. Verify the lesson page shows "ready" within a minute.

5. Tail `~/speakasap-portal/logs/app.log`: each upload should produce ONE `Record upload: …` line and ONE `[RECORDS_S3] commit ok …`. Zero entries in `records_s3_helper.log` for the upload path. Zero `upstream prematurely closed connection` in `/var/log/nginx/error.log` for these requests.

6. Run the existing `python3 scripts/verify_s3_records_upload.py` (helper-based) — must still pass; playback path is unchanged.

### 4. Out of scope

- Migrating playback to direct presigned GET (separate task).
- Removing `records_s3_helper.py`.
- Any nginx-microservice / blue-green changes (the legacy `scripts/deploy.sh` and `nginx/minio.conf` in this repo are no longer the deploy path; do not touch them).

## Constraints

- speakasap-portal: Django 1.11.2 + Python 3.4 — strictly no `f"…"`, no `dataclasses`, no `pathlib`, no `async`, no `typing` features past 3.4. Use `.format()` and `%`.
- Never commit or push. Make changes locally; user reviews and pushes.
- All config from `.env` / Kubernetes ConfigMaps/Secrets — no hardcoded URLs, keys, or origins.
- Add timestamped logging (`%(asctime)s [%(levelname)s] …`) at every step in the new endpoints; log `duration_ms` for the presign call, the HEAD validation, and the commit DB writes.
- No new Python files unless strictly necessary. Extend existing modules: `cabinet/teacher/views/lessons.py`, `cabinet/teacher/urls.py`, `cabinet/teacher/forms.py`, `cabinet/templates/teacher/lesson/finish_form.html`. The presign + commit views can live in a new file only if `views/lessons.py` is genuinely too large.

## Deliverables checklist

- [ ] `minio-microservice/k8s/configmap.yaml`: `RECORDS_CORS_ORIGINS` added.
- [ ] `minio-microservice/k8s/ingress.yaml`: `proxy-request-buffering: "off"` annotation.
- [ ] `minio-microservice/k8s/cors-job.yaml` (or equivalent post-deploy hook) that runs `mc cors set` against the bucket using the existing root credentials secret. Idempotent.
- [ ] `minio-microservice/scripts/set-bucket-cors.sh` updated (or wrapper added) so it works in K8s context.
- [ ] `minio-microservice/README.md`: short section "Browser presigned uploads (CORS)" with how to override origins.
- [ ] `speakasap-portal`: 2 new endpoints + URL routes + frontend submit handler + `RECORDS_USE_PRESIGNED_PUT` setting.
- [ ] Verification output for steps 1–6 above pasted in the PR description.

## Useful starting points to read

- `speakasap-portal/portal/utils/records_storage.py` — existing boto3 client config (SigV4, path-style, verify TLS) — copy this for presign generation.
- `speakasap-portal/cabinet/teacher/forms.py::RecordForm.save` and `cabinet/teacher/views/lessons.py::LessonViewBase.post` — extract the post-save side effects (LessonSalaryExpense, notifications, FinishLessonForm) into a helper used by both old and new paths.
- `speakasap-portal/education/lesson_records/models.py` — `record_upload_name`, `record_part_upload_name`, `LessonRecord.update_record`, `LessonRecordPart`.
- `minio-microservice/scripts/set-bucket-cors.sh` — already drafts the correct `<CORSConfiguration>` XML.
- `minio-microservice/docs/INTEGRATION.md` — bucket layout and key format (do not change).
