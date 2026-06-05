# System: speakasap-portal

## Architecture

⚠️ LEGACY: Django 1.11.2 + Python 3.4. Do NOT upgrade.
⚠️ K8s: PERMANENTLY EXCLUDED — this is a legacy Django app running on its own dedicated speakasap server. No K8s migration planned or needed.

- Frontend: React 15.4.2 + Redux + Webpack 2
- Lesson recordings: MinIO (minio-microservice)
- Deploy: `./scripts/deploy.sh` on speakasap server
- Process manager: supervisord

## Logs Analysis (speakasap-portal)

When analyzing production logs (via `.cursor/commands/logsanalyze.md`):

1. Connect: `ssh speakasap && cd speakasap-portal`
2. Check recent logs (last hour) for WARNING, EXCEPTION, ERROR
3. Group by issue type
4. Ignore errors >1 day old (likely already fixed)
5. Use Django 1.11.2 + Python 3.4 constraints for fixes
6. Ask for sudo commands when needed

Log locations:

- App: `./logs/app_errors.log`, `./logs/app.log`
- Nginx: `/var/log/nginx/error.log`, `/var/log/nginx/access.log`
- Celery: `/var/log/supervisor/`, `/tmp/speakasap-*.log`
- PostgreSQL: `/var/log/postgresql/postgresql-9.5-main.log`

## Integrations

| Service | Usage |
|---------|-------|
| database-server:5432 | PostgreSQL |
| logging-microservice:3367 | Logs |
| auth-microservice:3370 | User auth |
| minio-microservice:9000 | Lesson MP3 recordings |

## Current State
<!-- AI-maintained -->
Stage: active

## Known Issues
<!-- AI-maintained -->
- None
