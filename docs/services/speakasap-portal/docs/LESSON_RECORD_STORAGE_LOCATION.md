# Lesson record storage location

Determined from the codebase (portal utils + education.lesson_records.models).

## Path pattern (always)

Every lesson record file uses this **relative path/key** (S3 object key and NFS path under materials/):

```text
YYYY/MM/DD/lesson_<lesson_uuid>.<ext>
```

Example: `2026/03/07/lesson_e7b0b822-a201-4775-9682-7783da0cacfd.mp3`

(YYYY/MM/DD = date of the lesson from `localtime(now())` at save time; `<lesson_uuid>` = the Lesson’s UUID.)

## Where it is stored (depends on .env)

**If RECORDS_S3_ENDPOINT_URL is set and RECORDS_USE_NFS is not true:**

- **Backend:** S3 (MinIO) – `RecordsS3Storage`
- **Bucket:** `RECORDS_S3_BUCKET` (currently `speakasap-records` in production)
- **Endpoint URL:** Must be the **root URL only** (e.g. `https://minio.alfares.cz`).
- **Object key:** `YYYY/MM/DD/lesson_<lesson_uuid>.mp3` (trailing slashes are stripped everywhere so MinIO stores files, not directory placeholders; playback and presigned URLs use the key without trailing slash).
- **Physical location (dev):** MinIO’s data root is the canonical records directory `/srv/speakasap-records` on the dev host, and bucket `speakasap-records` is a subdirectory under that root. Files are stored at:

  - `/srv/speakasap-records/speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3`

  There are **no symlinks or sub-mounts** under the MinIO data root; `.minio.sys` and the bucket directory live on the same filesystem so MinIO can safely move objects from its temp area into the bucket.

- **URL (path-style):** `https://<RECORDS_S3_ENDPOINT_URL>/speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3` (for presigned GET). Playback: teacher/manager (and student) record playback is **streamed through the portal** (cabinet/views.MediaDownload): the portal reads from S3 and streams to the browser, so the client does not need to reach the MinIO host.

**If RECORDS_USE_NFS=true or RECORDS_S3_ENDPOINT_URL is not set:**

- **Backend:** NFS/filesystem – `FileSystemStorage` (`materials_fs`)
- **Location:** `settings.BASE_DIR + '/materials/' + path_pattern`
- **Full path example:** `<BASE_DIR>/materials/2026/03/07/lesson_<uuid>.mp3`
- On prod (e.g. speakasap): `BASE_DIR` is the portal project root, so files are under `.../materials/YYYY/MM/DD/...` (or the NFS mount that `materials/` uses).

## Portal and MinIO on different servers

The portal (e.g. speakasap) and MinIO run on **different servers**; they do not share an internal network. The portal must use the **public MinIO URL** (e.g. `https://minio.alfares.cz`) and traffic goes through the proxy. There is no internal/MinIO-container URL option in this setup.

### Where production runs (operator map)

| Role | Typical SSH host | Notes |
|------|------------------|--------|
| Django app + `records_s3_helper` (port **5051**) | **`speakasap`** | Project root e.g. `/home/portal_db/speakasap-portal`. Logs: `logs/app_errors.log`, `logs/records_s3_helper.log`. |
| MinIO service / data | **`alfares`** | Deployed from `minio-microservice` (and whatever terminates TLS in front of MinIO). |

Teacher uploads: browser → nginx on speakasap → Django → `http://127.0.0.1:5051/upload` (helper) → **HTTPS** to `RECORDS_S3_ENDPOINT_URL` (MinIO on alfares).

## TLS, `RECORDS_S3_VERIFY_SSL`, and helper `.env` loading

### Symptom: 500 on lesson save, 502 on retries

- **`logs/app_errors.log`:** `HTTPError: 500 ... http://127.0.0.1:5051/upload` during `LessonRecord` / `records_storage._save`.
- **`logs/records_s3_helper.log`:** `botocore.exceptions.SSLError` / `CertificateError`, e.g. hostname **`minio.alfares.cz`** does not match the certificate (**wrong CN/SAN**, e.g. cert issued for **`speakasap.alfares.cz`**).

That is a **TLS identity mismatch** on the MinIO HTTPS endpoint, not random nginx flakiness.

### Proper fix (alfares — one wildcard cert for `*.alfares.cz`, not per-service certs)

TLS for `minio.alfares.cz` is terminated by **nginx-microservice** on **alfares**, same pattern as other `*.alfares.cz` names. Infrastructure standard is **one DNS-01 wildcard** for `*.alfares.cz` + `alfares.cz`, material under `nginx-microservice/certificates/alfares.cz/`, and **symlinks** from each hostname directory (e.g. `certificates/minio.alfares.cz` → `alfares.cz`) so every vhost’s `ssl_certificate` path resolves to the **same** `fullchain.pem`.

**Operational guide:** See **`nginx-microservice/README.md`** → *Certificate Management* → *Wildcard certificates (DNS-01)*, then run `request-cert-wildcard.sh alfares.cz` and `symlink-subdomains-to-wildcard.sh alfares.cz` from that repo on alfares (Cloudflare `secrets/cloudflare.ini` required). **Whenever a new `*.alfares.cz` vhost is added**, add its hostname to **`certbot/scripts/symlink-subdomains-to-wildcard.sh`** (`SUBDOMAINS` for `alfares.cz`) and re-run the symlink script so the new name does not keep a stale leaf cert or a symlink to the wrong directory.

The URL in **`RECORDS_S3_ENDPOINT_URL`** (e.g. `https://minio.alfares.cz`) must then match a name covered by that wildcard (or the cert will still fail client verification).

### Helper must merge `.env` even when `RECORDS_S3_ENDPOINT_URL` is exported

`utils/records_s3_helper.py` runs under supervisord with `directory=<portal root>`. **`_load_dotenv_from_cwd()`** (called at startup from `main()`):

- Reads **`<portal>/.env`**.
- For each line whose key is **`RECORDS_S3_*`** or **`RECORDS_USE_NFS`**, sets `os.environ[key]` **only if that key is not already set** in the process environment.

**Important:** The helper must **not** skip reading `.env` merely because `RECORDS_S3_ENDPOINT_URL` is already present in the environment (e.g. injected by a shell wrapper). Otherwise **`RECORDS_S3_VERIFY_SSL`** in `.env` would never apply and the helper would keep **`verify_tls=True`** while you thought you had disabled verification.

After any `.env` change affecting S3, restart **both** processes (see below).

### Restart commands (production speakasap)

Supervisord config path may be either of these (same programs on this host):

```bash
# Prefer project-local config when it exists:
SUP_CFG=/home/portal_db/speakasap-portal/setup/supervisord.conf

supervisorctl -c "$SUP_CFG" restart records_s3_helper
supervisorctl -c "$SUP_CFG" restart speakasap
supervisorctl -c "$SUP_CFG" status records_s3_helper speakasap
```

Legacy / vagrant-style path (if used on a given VM):

```bash
supervisorctl -c /vagrant/setup/supervisord.conf restart records_s3_helper speakasap
```

### Quick verification

From portal root on **speakasap**:

```bash
python3 scripts/verify_s3_records_upload.py
```

After a helper restart, trigger any `/download` or `/upload` once, then check:

```bash
grep "Creating S3 client" logs/records_s3_helper.log | tail -1
```

You should see `verify_tls=True` or `verify_tls=False` matching **`RECORDS_S3_VERIFY_SSL`**.

## S3-only (no NFS fallback)

When `RECORDS_USE_NFS=false` and `RECORDS_S3_ENDPOINT_URL` is set, the portal uses **only** S3. There is no fallback to NFS if S3 init or upload fails (errors are raised).

If you see **SignatureDoesNotMatch**, use the root endpoint only (`https://minio.alfares.cz`) and ensure the proxy in front of MinIO forwards the `Host` and `Authorization` headers unchanged (see minio-microservice deploy and `nginx/minio.conf`). Playback is streamed through the portal, so the browser does not connect to MinIO directly; if playback still fails, check portal logs for "MediaDownload S3 stream failed".

## Local S3 helper (upload and download)

When S3 is enabled, lesson record upload and playback use a small local HTTP helper so all S3 access stays in one process.

**Portal configuration:**

- **RECORDS_S3_HELPER_URL** is loaded from `.env` into Django settings in `portal/settings.py` (same block as other `RECORDS_S3_*`). If unset, the portal defaults to `http://127.0.0.1:5051/upload` for the helper base. Set it in `.env` (e.g. `RECORDS_S3_HELPER_URL=http://127.0.0.1:5051/upload`) so that playback uses the helper (`via_helper=True` in logs) and avoids direct Django storage (which can 403 on HeadObject with some MinIO/proxy setups).
- **Upload:** `POST` to `RECORDS_S3_HELPER_URL`. Body: `multipart/form-data` with `bucket`, `key`, and `file`. The helper performs SigV4 `PutObject` to MinIO.
- **Download (playback):** When the helper URL is set, the portal streams record playback **only** via the helper: `GET` to `{helper_base}/download?bucket=...&key=...`. The helper streams the object from S3; the portal proxies the response to the browser. If the helper is configured but fails (404, 5xx, or connection error), the portal does **not** fall back to direct S3 (direct S3 from the portal often returns 403 HeadObject / SignatureDoesNotMatch when MinIO is behind a proxy). So playback depends on the helper: ensure `records_s3_helper` is running and has the same `RECORDS_S3_*` as the portal (e.g. from project `.env`).

**Unified record URL:** Teacher, student, and manager all use the **lesson UUID** in the record URL (e.g. `…/materials/records/<lesson_uuid>.mp3`). The same file is available at one logical path per lesson; permission is enforced by role in `cabinet.record_playback`.

**Student playback:** The student API returns an **absolute** record URL (via `get_full_url('student:lesson_record', args=[lesson.pk])`) with `?token=...` so the in-page audio player can load the MP3 correctly regardless of the current route.

**Fallback when record key is empty:** If `LessonRecord.record` is empty but the file exists in S3 at the canonical key `YYYY/MM/DD/lesson_<lesson_uuid>.mp3`, playback still works: the portal builds the key from the lesson date and streams from storage when the key exists.

On production (`speakasap`), the helper runs on localhost and is supervised by `supervisord`:

- Repo ini: `setup/supervisor/records_s3_helper.ini`
- Deployed ini: copied into `/vagrant/setup/supervisor/records_s3_helper.ini` so it is picked up by `/vagrant/setup/supervisord.conf`
- The helper loads `RECORDS_S3_*` from the project `.env` when started by supervisord (no env vars need to be set in the ini). Details and production paths: **TLS, `RECORDS_S3_VERIFY_SSL`, and helper `.env` loading** above.

Use the **project** supervisord config (not the system one). On the production host the config file is under the portal tree (e.g. `/home/portal_db/speakasap-portal/setup/supervisord.conf`) instead of `/vagrant/setup/`:

```bash
supervisorctl -c /vagrant/setup/supervisord.conf reread
supervisorctl -c /vagrant/setup/supervisord.conf update
supervisorctl -c /vagrant/setup/supervisord.conf status records_s3_helper
```

The deploy script restarts both helper and app:

```bash
./scripts/deploy.sh   # runs yarn build, collectstatic, S3 verification, then:
supervisorctl -c /vagrant/setup/supervisord.conf restart records_s3_helper || true
supervisorctl -c /vagrant/setup/supervisord.conf restart speakasap
```

The portal only ever talks to the helper over `http://127.0.0.1`, and the helper is responsible for using the `RECORDS_S3_*` configuration to reach MinIO.

## How to check on a running environment

From the portal project root:

```bash
python manage.py show_record_storage
```

This prints the current backend (S3 vs NFS), bucket/path pattern, and full location.

## 502 / upload depends on who uploads and which student

If the teacher sees 502 Bad Gateway on record upload while another user (e.g. same person as student) succeeds, the **same code path** is used; the difference is usually **payload or timing**:

- **Multiple files** in one submit: each file is uploaded to the helper in sequence. N files ⇒ N calls; if each is slow, total can exceed worker timeout (65s) ⇒ 502.
- **One large file**: a single slow MinIO write can exceed the request timeout (60s) if MinIO disk is very slow.

So "depends on who and which student" often means that **that teacher** tends to upload **multiple or large files** for **that lesson**, while the working case is one small file.

**Diagnostic**: After each record submit the portal logs one line to `app.log`:

- `Record upload: user_id=... teacher_id=... student_pk=... lesson_uuid=... num_files=N total_bytes=B`

Correlate with the next 502 or `[RECORDS_S3] Helper upload read timeout` in `app_errors.log`: if that request had `num_files>1` or large `total_bytes`, the fix is to make the helper/MinIO faster or to process uploads asynchronously (e.g. one file per request, or queue to Celery), not to increase timeouts.

## MinIO disk I/O (alfares server) and large uploads

If **large records** (e.g. 27MB) start timing out after working before, check **MinIO on the alfares server**:

```bash
ssh alfares
docker logs $(docker ps -q --filter name=minio) 2>&1 | tail -100
```

Look for:

- `taking drive /data offline: unable to write+read for 30s` – MinIO’s disk is periodically unwritable for ~30s. Uploads (portal → helper → MinIO) then exceed the helper/portal timeouts and you get 500 or 502.
- `InsufficientWriteQuorum` or `IncompleteBody` – same underlying disk/storage issue.

**Fix**: Resolve disk I/O on alfares. Best fix: **move MinIO data to SSD** (e.g. `/mnt/docker-data/minio-data` on alfares) so writes complete in seconds instead of hitting 30s freezes. That speeds up all uploads and makes timeouts unnecessary. Timeouts are set to 60s (portal → helper, helper → MinIO) and gunicorn worker 65s so large records can complete while MinIO is still on slow disk; reduce back to 30s once MinIO is on SSD.

**Helper logs**: `logs/records_s3_helper.log` (on speakasap portal server) now has timestamped lines: “Record upload started at …”, “Form parsed at …”, “Upload to MinIO started at …”, “Upload to MinIO complete at …”. If the log stops at “Upload to MinIO started” and never reaches “complete”, the hang is in MinIO (or network to MinIO).
