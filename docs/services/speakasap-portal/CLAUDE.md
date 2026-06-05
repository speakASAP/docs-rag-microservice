# CLAUDE.md (speakasap-portal)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## speakasap-portal

**Purpose**: Django-based legacy education portal for speakasap — lesson management, teacher/student workflows, lesson recording storage.  
**Deploy target**: `ssh speakasap` server (NOT alfares — this is the only service that lives elsewhere)  
**Stack**: Django 1.11.2 · Python 3.4 · React 15.4.2 · Redux · Webpack 2 · supervisord

### CRITICAL: Legacy constraints

- **DO NOT** upgrade Django or Python — Django 1.11.2 + Python 3.4 only
- **DO NOT** touch supervisord configs without testing in Vagrant first
- Lesson recordings are private — presigned URL access via minio-microservice only

### Log locations (on speakasap server)

```text
./logs/app_errors.log       # App errors
./logs/app.log              # App general
/var/log/nginx/error.log    # Nginx
/var/log/supervisor/        # Celery workers
/tmp/speakasap-*.log        # Celery tasks
```

### Deploy (on speakasap server, not alfares)

```bash
ssh speakasap
cd speakasap-portal
./scripts/deploy.sh
```
