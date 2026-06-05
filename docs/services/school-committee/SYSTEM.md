# SYSTEM.md — school-committee

## Runtime

| Item | Value |
|------|-------|
| Stack | Next.js 14+ App Router, TypeScript strict |
| Deployment | Kubernetes, namespace `statex-apps` |
| Image registry | `localhost:5000/school-committee` |
| Blue port | 4800 |
| Green port | 4801 |
| Domain | `strilkove.cz` |
| Health live | `GET /api/health/live` |
| Health ready | `GET /api/health/ready` |

## Environment Variables

### Non-sensitive (ConfigMap)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `SERVICE_NAME` | `school-committee` |
| `DOMAIN` | `strilkove.cz` |
| `PORT` | `4800` |
| `APP_BASE_URL` | `https://strilkove.cz` |
| `AUTH_SERVICE_BASE_URL` | `http://auth-microservice.statex-apps.svc.cluster.local:3370` |
| `AUTH_SERVICE_AUDIENCE` | `school-committee` |
| `DB_HOST` | `db-server-postgres` |
| `DB_PORT` | `5432` |
| `DB_USER` | `dbadmin` |
| `DB_NAME` | `school_committee_platform` |
| `LOGGING_SERVICE_URL` | `http://logging-microservice.statex-apps.svc.cluster.local:3367` |
| `LOGGING_SERVICE_API_PATH` | `/api/logs` |
| `NOTIFICATION_SERVICE_BASE_URL` | `http://notifications-microservice.statex-apps.svc.cluster.local:3368` |
| `DEFAULT_LOCALE` | `cs` |
| `SUPPORTED_LOCALES` | `cs,en,ru,uk` |
| `PUBLIC_REPORT_CACHE_TTL_SECONDS` | `300` |

### Secrets (Vault → ESO → K8s Secret)

Vault path prefix: `secret/prod/school-committee/`

| K8s Secret key | Vault path | Description |
|----------------|-----------|-------------|
| `AUTH_SERVICE_CLIENT_SECRET` | `.../auth` | Auth service client secret |
| `DB_SERVICE_TOKEN` | `.../db` | PostgreSQL password (used as DB password in DATABASE_URL) |
| `PAYMENT_WEBHOOK_SECRET` | `.../payments` | Payment webhook verification |
| `PAYMENT_ACCOUNT_IBAN` | `.../payments` | School committee IBAN |
| `PAYMENT_ACCOUNT_NUMBER` | `.../payments` | Czech account number |
| `PAYMENT_BANK_CODE` | `.../payments` | Bank code (e.g. 0800) |
| `SMTP_HOST` | `.../notifications` | Mail server host |
| `SMTP_USER` | `.../notifications` | Mail server user |
| `SMTP_PASSWORD` | `.../notifications` | Mail server password |
| `EMAIL_FROM` | `.../notifications` | Sender address |
| `STORAGE_ACCESS_KEY` | `.../storage` | MinIO/S3 access key |
| `STORAGE_SECRET_KEY` | `.../storage` | MinIO/S3 secret key |
| `STORAGE_BUCKET` | `.../storage` | Storage bucket name |

## K8s Manifests

```
k8s/
  configmap.yaml
  external-secret.yaml
  deployment.yaml
  service.yaml
  ingress.yaml
```

## Deploy commands

```bash
./scripts/deploy.sh

docker build -t localhost:5000/school-committee:latest .
docker push localhost:5000/school-committee:latest
kubectl apply -f k8s/ -n statex-apps
kubectl rollout status deployment/school-committee -n statex-apps
```

## Rollback

```bash
kubectl rollout undo deployment/school-committee -n statex-apps
```

## Local dev

```bash
cp .env.example .env.local
# fill in local dev values (fake data only — see docs/19-vault-secrets.md)
npm install
npm run dev
```
