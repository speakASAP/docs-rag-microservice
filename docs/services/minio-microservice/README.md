# MinIO Microservice (Records Storage)

S3-compatible object storage microservice for lesson records. Runs on **alfares server** (85.163.140.109). Used by speakasap-portal (prod) for storing and serving lesson MP3 recordings without NFS. MinIO stores lesson MP3s in a bucket rooted at the canonical data directory `/srv/speakasap-records` on alfares (no NFS dependency): bucket `speakasap-records` maps to `/srv/speakasap-records/speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3`.

**Note:** The portal (speakasap) and MinIO are on **different servers**; they do not share an internal network. The portal must use the **public MinIO URL** (e.g. `https://minio.alfares.cz`), and all S3 traffic goes through the proxy. The proxy must forward `Host` and `Authorization` unchanged for S3 SigV4 (see `nginx/minio.conf` and deploy).

## Purpose

* Replace NFS-based shared storage for course records with S3 API.
* Bucket: `RECORDS_BUCKET` (currently `speakasap-records`). Object key: `YYYY/MM/DD/lesson_UUID.mp3`.
* Prod uploads via S3 PUT; playback via presigned GET URLs (no file streaming on prod).

## Deployment (Alfares Server)

MinIO runs on alfares only as the backing store for lesson records. nginx-microservice fronts it via HTTPS (`https://minio.alfares.cz`) using the standard blue/green deployment flow and the MinIO Docker container as defined in `docker-compose.blue.yml` / `docker-compose.green.yml`. The proxy and upstream container mapping are managed entirely by nginx-microservice deployment scripts; no direct host-specific upstreams (such as `host.docker.internal`) are required.

### Prerequisites

* Alfares server: 85.163.140.109, Nginx installed.
* MinIO binary at `/usr/local/bin/minio` (setup-dev.sh warns if missing; install manually).
* MinIO Client (`minio-mc`) for init-bucket.sh: <https://min.io/docs/minio/linux/reference/minio-mc.html>  
  If the system has Midnight Commander (package `mc`), install the MinIO client as `minio-mc` to avoid conflict:  
  `wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/minio-mc && chmod +x /usr/local/bin/minio-mc`

### Initial deployment (first time)

Run on **alfares server** in this order:

1. **Setup** (user, dirs, systemd, .env):

   ```bash
   cd /path/to/minio
   sudo scripts/setup-dev.sh
   ```

2. **Install MinIO binary** if not present (setup-dev.sh will warn):

   ```bash
   sudo wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
   sudo chmod +x /usr/local/bin/minio
   sudo chown minio:minio /usr/local/bin/minio
   ```

3. **Set credentials** in `/srv/minio/.env` (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD).

4. **Enable and start MinIO**:

   ```bash
   sudo systemctl enable minio
   sudo systemctl start minio
   sudo systemctl status minio
   ```

5. **Create bucket** (requires MinIO Client as `minio-mc` (preferred) or `mc` when it is the MinIO client, and .env with credentials):

   ```bash
   cd /path/to/minio
   ./scripts/init-bucket.sh
   ```

6. **Optional – Nginx (dev)**: when MinIO is behind nginx-microservice, `nginx/nginx-api-routes.conf` lists `/`, `/minio/`, and `/records/`. Root `/` is required so the portal can use `https://minio.alfares.cz` (no path) and SigV4 path matches. After changing it, redeploy via `./scripts/deploy.sh`.

7. **Optional – deploy.sh**: only if MinIO is later added to nginx-microservice on statex (per this README, MinIO runs on alfares only; deploy.sh is for blue/green on statex).

### 1. Run MinIO (systemd)

```bash
# On alfares (ssh alfares)
sudo scripts/setup-dev.sh   # Creates user, dir, systemd unit, installs MinIO if needed
sudo systemctl enable minio
sudo systemctl start minio
sudo systemctl status minio
```

MinIO API: `127.0.0.1:9000`, Console: `127.0.0.1:9001`. Not exposed publicly; Nginx proxies.

> **Data root (alfares Docker deploy)**  
> When deployed via Docker on alfares, MinIO’s data root is the **canonical records directory**:
>
> ```yaml
> # docker-compose.{blue,green}.yml
> services:
>   minio:
>     volumes:
>       - /srv/speakasap-records:/data
> ```
>
> MinIO metadata lives under:
>
> * `/srv/speakasap-records/.minio`
> * `/srv/speakasap-records/.minio.sys`
>
> Bucket `speakasap-records` is a directory under that root:
>
> * `/srv/speakasap-records/speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3`
>
> **Do not place mounts or symlinks under `/data`** (inside the container) – MinIO requires that `.minio.sys` and all bucket paths live on the same filesystem. Sub-mounts or cross-device symlinks under `/data` will cause errors such as `Rename across devices not allowed` and S3 `AllAccessDisabled`.

With `RECORDS_BUCKET=speakasap-records` and object keys `YYYY/MM/DD/lesson_<uuid>.mp3`, files are at:

* `/srv/speakasap-records/speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3` on alfares (canonical copy)
* Exposed via S3 as `speakasap-records/YYYY/MM/DD/lesson_<uuid>.mp3`.

### 2. Nginx (alfares)

Add snippet from `nginx/minio.conf` into alfares Nginx config so that:

* API: e.g. `https://<alfares-domain>/minio/` → `http://127.0.0.1:9000`
* Or subdomain: `https://minio.<alfares-domain>` → `http://127.0.0.1:9000`

Enable HTTPS using existing certificate process on alfares.

### 3. Initialize bucket

```bash
# On alfares, after MinIO is running
./scripts/init-bucket.sh
```

Creates bucket `${RECORDS_BUCKET}` (defaults to `speakasap-records` when using `/srv/minio/.env`), disables public access. All access via presigned URLs from prod.

### 4. Check MinIO (diagnose AllAccessDisabled / 500)

```bash
# On alfares
ssh alfares
cd minio-microservice   # or cd /home/ssf/Documents/Github/minio-microservice
./scripts/check-minio.sh
```

Verifies: MinIO process or Docker, port 9000, .env keys, bucket list, anonymous policy, and a test PUT. If test PUT fails, fix bucket policy or credentials so the portal can upload.

### 5. Diagnose 520 / Nginx / certificates on alfares

```bash
ssh alfares
cd /home/ssf/Documents/Github/minio-microservice
./scripts/diagnose-minio-dev.sh
```

Runs: MinIO status, direct PUT to MinIO (127.0.0.1:9000), Nginx config grep, PUT via Nginx with Host header, HTTPS PUT to the MinIO hostname, SSL cert check, last Nginx errors. Use this when prod gets 520 or Method Not Allowed to see if the issue is MinIO, Nginx proxy, or SSL on alfares.

### 6. Request diagnostics (SignatureDoesNotMatch, etc.)

After reproducing an upload error from the portal, run on **alfares** to see what MinIO and Nginx logged:

```bash
ssh alfares
cd /path/to/minio-microservice
./scripts/log-request-diagnostics.sh
```

Shows: last 80 lines of MinIO container log, Nginx access log lines for minio.alfares.cz/records/, Nginx error log. Compare with portal logs: `grep RECORDS_S3 ~/speakasap-portal/logs/app.log` on **speakasap** (endpoint, path, secret_len). For SignatureDoesNotMatch, ensure Host and path at MinIO match what the portal used to sign.

### 7. S3 SigV4 signature test (PUT + GET)

Run after **redeploy** to verify two-way S3 (PUT then GET, same as portal):

```bash
# On alfares (or prod host that can reach MinIO):
cd /path/to/minio-microservice
./scripts/test-s3-signature.sh
```

* **Test 1 (direct)**: PUT then GET to `http://127.0.0.1:9000` with SigV4 path-style. Expect: `PUT OK`, `GET OK`, `DELETE OK`, then `Direct: OK`. MinIO must be running (e.g. Docker).
* **Test 2 (via Nginx)**: PUT then GET to `https://minio.alfares.cz`. Expect: `PUT OK`, `GET OK`, then `Via Nginx: OK`. If you see "authorization mechanism not supported", the proxy is altering/stripping the Authorization header; ensure nginx forwards `Host` and `Authorization` (see `nginx/minio.conf`).
* **Test 3**: Last 30 lines of MinIO server logs (when MinIO runs in Docker or systemd).

Optional: `S3_TEST_VERBOSE=1 ./scripts/test-s3-signature.sh` prints endpoint and bucket before each test. To use portal credentials: set `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` from portal `.env` (RECORDS_S3_*) then run the script. To skip the Nginx test (e.g. local/CI when minio.alfares.cz is not deployed): `S3_TEST_SKIP_NGINX=1 ./scripts/test-s3-signature.sh`; the script exits 1 if any run test fails.

Uses system python3+boto3, or repo venv `.venv-signature-test`, or Docker (python:3.11-slim) if boto3 is not installed.

## Configuration

* `.env.example`: keys only (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, RECORDS_BUCKET, etc.).
* On dev: copy to `.env` and set MINIO_ROOT_USER / MINIO_ROOT_PASSWORD (strong).
* Prod (speakasap-portal): set S3 endpoint URL (root only), bucket, access key, secret key in portal `.env` (see speakasap-portal docs). Use the root URL so SigV4 path matches what MinIO receives:

  ```env
  RECORDS_S3_ENDPOINT_URL=https://minio.alfares.cz
  RECORDS_S3_BUCKET=speakasap-records
  ```

* If init-bucket.sh reports "signature does not match": use the same credentials as the MinIO server (systemd uses `/srv/minio/.env`). Ensure `.env` has Unix line endings (LF, not CRLF).

## Access

* **From prod (speakasap-portal)**: HTTPS URL to dev MinIO via the public hostname (currently `https://minio.alfares.cz`, fronted by nginx-microservice) with credentials in env. Portal uses S3 SDK to PUT objects and generate presigned GET URLs.
* **Direct (dev only)**: `http://127.0.0.1:9000` (API), `http://127.0.0.1:9001` (Console). Keep MinIO bound to localhost.

## Security

* MinIO listens on 127.0.0.1 only; external access is only via nginx-microservice / Cloudflare on `https://minio.alfares.cz`.
* Bucket `speakasap-records` is private; no anonymous read.
* Presigned URL expiration ≤ 24 hours (configured in portal).
* Store MINIO_ROOT_USER / MINIO_ROOT_PASSWORD and portal S3 keys in env only; never commit.

## Integration

* See [docs/INTEGRATION.md](docs/INTEGRATION.md) for S3 API usage (PUT, presigned GET) and key layout.
* Implementation plan: [docs/MIGRATION_NFS_TO_S3_IMPLEMENTATION_PLAN.md](docs/MIGRATION_NFS_TO_S3_IMPLEMENTATION_PLAN.md).

## Browser Presigned Uploads (CORS)

For OSS MinIO, browser CORS is configured globally via MinIO API config (not bucket-level `PutBucketCors`).

- Allowed origins are configured by `RECORDS_CORS_ORIGINS` (comma-separated), default:
  - `https://speakasap.com,https://www.speakasap.com`
- Deployment maps `RECORDS_CORS_ORIGINS` to `MINIO_API_CORS_ALLOW_ORIGIN`.
- Manual apply (if needed): `./scripts/set-bucket-cors.sh` (sets `api.cors_allow_origin`).

## Standards

* Follows project README/CREATE_SERVICE conventions: README, docs/, .env.example, scripts.
* No service-registry on statex (service lives on alfares).
* Logging: use central logging from applications that call MinIO (e.g. speakasap-portal); MinIO itself logs to systemd/journal.

## Troubleshooting uploads from speakasap-portal

If `speakasap-portal` reports helper 500s or `NoSuchBucket` errors when calling `PutObject` to `https://minio.alfares.cz`:

**Playback "Could not connect to the server" / NotSupportedError**

The teacher/manager play button redirects the browser to a presigned URL on `https://minio.alfares.cz/...`. If the browser cannot reach that host (firewall, DNS, or HTTPS not exposed), you get connection failure and NotSupportedError.

* Ensure `minio.alfares.cz` is reachable from the **client** (teacher’s browser): open `https://minio.alfares.cz` in a new tab from the same machine; or run `curl -I https://minio.alfares.cz` from that network.
* CORS is added by deploy so the portal origin can load the audio; redeploy MinIO to apply it.

### Nginx API routes and deploy patches

* `nginx/nginx-api-routes.conf` registers `/`, `/minio/`, and `/records/`. Root `/` is required for path-style S3 when the portal uses `https://minio.alfares.cz` (no path prefix).
* `scripts/deploy.sh` after deploy: patches generated configs to use `minio-proxy-settings.conf` (SigV4 headers), strips `/minio` prefix in the `/minio/` location so MinIO sees path-style keys, and adds CORS headers so the browser can play presigned GET responses.

0. **AllAccessDisabled ("All access to this resource has been disabled")**

   This usually means MinIO cannot:

   * Write to its metadata or bucket directory, **or**
   * Atomically move objects from `.minio.sys/tmp` into the bucket because the bucket path lives on a **different filesystem** (cross-device rename).

   Fix on the **host that actually serves minio.alfares.cz** (where the MinIO that receives the portal's requests runs).

   **Confirm which host serves the URL:** From speakasap or your laptop run `getent hosts minio.alfares.cz` or `dig +short minio.alfares.cz`. The IP is the host that must have correct permissions and a running MinIO.

   If MinIO logs show:

   ```text
   Error: Rename across devices not allowed, please fix your backend configuration
   FATAL Invalid command line arguments: Cross-device mounts detected on path (/data) ...
   ```

   then there is a **sub-mount or cross-device symlink under `/data`**. Remove any mounts/symlinks inside the MinIO data root and keep all bucket directories on the same filesystem (see data-root section above).

   **On the host that serves minio.alfares.cz** (e.g. statex):

   * **Docker MinIO** (typical when deployed via `./scripts/deploy.sh` on alfares): the container uses `/srv/speakasap-records` on that host as its data root:

     ```yaml
     volumes:
       - /srv/speakasap-records:/data
     ```

     Ensure ownership and permissions:

     ```bash
     sudo chown -R minio:minio /srv/speakasap-records
     sudo chmod -R u+rwX /srv/speakasap-records
     docker restart minio-microservice-blue   # or green, whichever is active
     ```

   * **Systemd MinIO** (if this host uses systemd MinIO instead of Docker): also make the **bucket target** writable:

     ```bash
     sudo chown -R minio:minio /srv/speakasap-records
     sudo chmod -R u+rwX /srv/speakasap-records
     sudo systemctl restart minio
     sudo systemctl status minio
     ```

   **After any permission fix, restart MinIO** (systemd or Docker) so it clears cached error state.

   Then on the portal host:

   ```bash
   ssh speakasap
   supervisorctl -c /vagrant/setup/supervisord.conf restart records_s3_helper
   cd ~/speakasap-portal && python3 scripts/verify_s3_records_upload.py
   ```

   Expect helper 200 and "S3 upload path OK".

1. **Verify bucket and credentials directly from alfares:**

   ```bash
   ssh alfares
   cd /home/ssf/Documents/Github/minio-microservice
   ./scripts/test-s3-signature.sh
   ```

   * Test 1 must show `PUT OK` / `GET OK` against `http://127.0.0.1:9000` and bucket `speakasap-records`.

2. **Run request diagnostics after reproducing the error from the portal:**

   ```bash
   ssh alfares
   cd /home/ssf/Documents/Github/minio-microservice
   ./scripts/log-request-diagnostics.sh
   ```

   * Check MinIO logs for the exact bucket/key and error code.
   * Confirm that nginx is forwarding `Host` and `Authorization` unchanged and that the request reaches the MinIO instance backing `speakasap-records`.

3. **On the portal host (`speakasap`), re-run the verification helper:**

   ```bash
   ssh speakasap
   cd /home/portal_db/speakasap-portal
   python3 scripts/verify_s3_records_upload.py
   ```

   * When correctly configured, this should return HTTP 200 from the helper and a successful `head_object` on the same bucket/key in MinIO.

### Systemd MinIO fails to start (exit-code / FAILURE) on alfares

If `systemctl status minio` shows `Active: activating (auto-restart) (Result: exit-code)`:

* **Port conflict:** Docker MinIO (minio-microservice-blue/green) may already be bound to 9000. Only one process can listen on 127.0.0.1:9000. Check with `ss -tlnp | grep 9000`.
* **Ownership:** If `/srv/minio-data` was changed to `1000:1000` for Docker, systemd MinIO (user `minio`, UID 995) cannot write there.

**Recommended when using deploy (Docker blue/green):** run only Docker MinIO on alfares and disable systemd. Use **minio:minio** for both dirs (Docker runs as root and can write to them):

```bash
# On alfares
sudo systemctl stop minio
sudo systemctl disable minio
sudo chown -R minio:minio /srv/minio-data /srv/speakasap-records
sudo chmod -R u+rwX /srv/minio-data /srv/speakasap-records
cd ~/Documents/Github/minio-microservice
docker stop minio-microservice-blue; docker rm minio-microservice-blue
docker compose -f docker-compose.blue.yml up -d
```

Then from speakasap: `supervisorctl -c /vagrant/setup/supervisord.conf restart records_s3_helper` and `python3 scripts/verify_s3_records_upload.py`.
