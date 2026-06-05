# Business: minio-microservice
>
> ⚠️ IMMUTABLE BY AI.

## Goal

S3-compatible object storage for lesson recordings and file artifacts. Private bucket with presigned URL access.

## Constraints

- Bucket `records` layout: `YYYY/MM/DD/lesson_<uuid>.mp3`
- No anonymous read — presigned URLs only
- AI must never expose storage credentials

## Consumers

speakasap-portal (lesson recordings), business-orchestrator (task artifacts).

## SLA

- API port: 9000/9002
- Console port: 9001/9003
- Production: <https://minio.alfares.cz>
