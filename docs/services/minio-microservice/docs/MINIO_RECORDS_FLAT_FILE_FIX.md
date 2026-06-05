# Fixing record playback when MinIO returns NoSuchKey (flat files)

If the portal helper returns 404 and supervisor log shows `Helper download S3 error: ... code=NoSuchKey`, the object may exist as a **flat file** on disk but MinIO did not create it via the API, so MinIO's namespace does not list it.

**You do not need to create or change records in the database.** The DB already has the keys in `LessonRecord.record`; the problem is only that MinIO's object namespace does not contain these files. The fix is to register each file in MinIO (one PutObject per file) so MinIO can serve it.

## Bulk fix for all files (~100k or more)

Run once on alfares. This moves each flat file aside, uploads it via PutObject, then removes the backup so MinIO owns the object.

```bash
cd /home/ssf/Documents/Github/minio-microservice
./scripts/run-bulk-register.sh
```

- **First run a dry-run** to see how many files will be processed and confirm paths:
  `./scripts/run-bulk-register.sh --dry-run`
- **Optional: process in chunks** (e.g. 10k at a time) and resume after each chunk:
  `./scripts/run-bulk-register.sh --limit 10000 --resume /tmp/done.txt`
  Then: `./scripts/run-bulk-register.sh --resume /tmp/done.txt` (script skips keys in that file).
- **Rough time:** single-threaded ~5–15 files/sec depending on size; 100k files ≈ 2–6 hours.

The script runs inside a temporary container that has the MinIO data volume mounted and network access to MinIO; it does not modify the database.

## One-time fix for a single record (on alfares)

1. Move the flat file aside inside the MinIO container (so MinIO can create the object at that key):

   ```bash
   docker exec minio-microservice-blue mv \
     /data/speakasap-records/2025/10/20/lesson_<UUID>.mp3 \
     /data/speakasap-records/2025/10/20/lesson_<UUID>.mp3.bak
   ```

2. Copy the backup to the host and upload via S3 API:

   ```bash
   docker cp minio-microservice-blue:/data/speakasap-records/2025/10/20/lesson_<UUID>.mp3.bak /tmp/lesson_upload.mp3
   docker run --rm --network nginx-network -v /tmp:/tmp:ro \
     -e AWS_ACCESS_KEY_ID=minioadmin \
     -e AWS_SECRET_ACCESS_KEY='<MINIO_ROOT_PASSWORD from .env>' \
     amazon/aws-cli s3api put-object \
     --bucket speakasap-records \
     --key '2025/10/20/lesson_<UUID>.mp3' \
     --body /tmp/lesson_upload.mp3 \
     --content-type audio/mpeg \
     --endpoint-url http://minio-microservice-blue:9000
   ```

3. Remove the backup in the container:

   ```bash
   docker exec minio-microservice-blue rm /data/speakasap-records/2025/10/20/lesson_<UUID>.mp3.bak
   ```

4. Test from speakasap: open the lesson record URL or call the helper download endpoint; it should return 200.

## Bulk fix

For many records, use the same steps in a loop over the list of keys, or a script that uses `aws s3api put-object` for each file (after moving flat files aside if needed).
