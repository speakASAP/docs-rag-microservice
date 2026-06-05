# CLAUDE.md — school-committee

Read `/docs` before making any implementation decisions. `/docs` is the single source of truth.

Agent reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## What This Is

Mobile-first web platform for Czech primary school parent committees. Parents can contribute financially (QR bank payments), volunteer for tasks, and submit feedback. Committee gets transparency tools. No social feeds, no child accounts in MVP.

---

## Stack

- **Frontend + BFF:** Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod
- **Deployment:** Kubernetes (`statex-apps` namespace), Traefik ingress, cert-manager TLS
- **Secrets:** Vault → ESO → K8s Secret
- **Languages:** cs / en

---

## Ports

- **Blue:** 4800
- **Green:** 4801
- **Domain:** `strilkove.cz`
- **Health:** `GET /api/health/live` and `GET /api/health/ready`

---

## Infrastructure Integrations

| Service | Env var | Address | Purpose |
|---------|---------|---------|---------|
| Auth | `AUTH_SERVICE_BASE_URL` | `http://auth-microservice.statex-apps.svc.cluster.local:3370` | Identity, JWT, roles |
| PostgreSQL | `DB_HOST` / `DB_SERVICE_TOKEN` | `db-server-postgres.statex-apps.svc.cluster.local:5432` | Direct ORM connection (Prisma) |
| Logging | `LOGGING_SERVICE_URL` | `http://logging-microservice.statex-apps.svc.cluster.local:3367` | Structured logs |
| Notifications | `NOTIFICATION_SERVICE_BASE_URL` | `http://notifications-microservice.statex-apps.svc.cluster.local:3368` | Email alerts |
| Payments | internal QR generator | — | Czech QR bank payment generation |
| Storage | MinIO | `http://minio-microservice.statex-apps.svc.cluster.local:9000` | Task photos, receipts |

---

## Architecture Constraints (from ADRs in docs/59-risks-and-decisions.md)

- **ADR-001:** Never implement auth internally. Use auth-microservice.
- **ADR-002:** Direct PostgreSQL via ORM (Prisma). Shared instance at `db-server-postgres.statex-apps.svc.cluster.local:5432`.
- **ADR-003:** All secrets from Vault. Never `.env` in production.
- **ADR-004:** QR bank payments for MVP. No Stripe.
- **ADR-005:** No child accounts in MVP.
- **ADR-006:** All documentation stays in `/docs`.

---

## Vault Secret Paths

```
secret/prod/school-committee/auth         → AUTH_SERVICE_CLIENT_SECRET
secret/prod/school-committee/db           → DB_SERVICE_TOKEN  (= DB password)
secret/prod/school-committee/payments     → PAYMENT_WEBHOOK_SECRET, PAYMENT_ACCOUNT_IBAN, PAYMENT_ACCOUNT_NUMBER, PAYMENT_BANK_CODE
secret/prod/school-committee/notifications → SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
secret/prod/school-committee/storage      → STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET
```

## Database Connection

Direct PostgreSQL via Prisma. Construct `DATABASE_URL` at runtime — never hardcode:

```ts
const url = `postgresql://${DB_USER}:${DB_SERVICE_TOKEN}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
```

ConfigMap supplies: `DB_HOST=db-server-postgres`, `DB_PORT=5432`, `DB_USER=dbadmin`, `DB_NAME=school_committee_platform`  
Vault supplies: `DB_SERVICE_TOKEN` (password)

---

## Deploy

```bash
# Build and push
./scripts/deploy.sh

docker build -t localhost:5000/school-committee:latest .
docker push localhost:5000/school-committee:latest

# Apply K8s manifests
kubectl apply -f k8s/ -n statex-apps

# Verify
kubectl get pods -n statex-apps -l app=school-committee
kubectl logs -n statex-apps -l app=school-committee --tail=50
curl https://strilkove.cz/api/health/live
```

---

## RBAC Roles

| Role | Type |
| ---- | ---- |
| parent | domain |
| committee | domain |
| teacher | domain |
| school_staff | domain |
| admin | domain |

Roles managed via auth-microservice RBAC. Use Model B (platform-owned domain roles). Token carries `sub`/`email`/`tenant_id`/`school_id`; platform queries roles from DB service.

---

## Critical Rules for Coding Agents

1. **Never store secrets in code or ConfigMap.** Vault only.
2. **Never implement authentication.** Delegate entirely to auth-microservice.
3. **ORM only for DB access.** Connect via Prisma to `db-server-postgres.statex-apps.svc.cluster.local:5432`. No raw SQL except atomic transactions.
4. **Never expose individual parent payment status publicly.** Aggregated reports only.
5. **Never create child user accounts in MVP.**
6. **QR payment QR codes must be server-generated.** No client-side generation of payment data.
7. **Every mutation must write an audit event** to the `audit_events` table in the same transaction.
8. **Every request must carry `request_id`.** Propagate to all upstream services.
9. **Frontend role checks are UX only.** BFF enforces all authorization.
10. **All docs stay in `/docs`.** Do not create docs elsewhere.

---

## Logging Pattern

POST to `LOGGING_SERVICE_URL/api/logs`:
```json
{
  "service": "school-committee",
  "level": "info",
  "msg": "<message>",
  "request_id": "<uuid>",
  "duration_ms": 42,
  "timestamp": "<ISO8601>"
}
```

---

## Key Docs Quick Reference

| Topic | File |
|-------|------|
| MVP scope and cuts | `docs/02-mvp-scope.md` |
| System architecture | `docs/10-system-architecture.md` |
| Auth contract | `docs/14-auth-service-contract.md` |
| Domain model / DB schema | `docs/30-domain-model.md` |
| Payment architecture | `docs/17-payment-architecture-cz.md` |
| K8s deployment | `docs/18-kubernetes-deployment.md` |
| Vault secrets | `docs/19-vault-secrets.md` |
| REST API contracts | `docs/32-api-rest-contracts.md` |
| OpenAPI spec | `docs/33-openapi.yaml` |
| Security model | `docs/40-security-model.md` |
| GDPR | `docs/41-gdpr-and-data-protection.md` |
| Child safety | `docs/42-child-safety-and-moderation.md` |
| Coding standards | `docs/51-coding-standards.md` |
| Testing strategy | `docs/52-testing-strategy.md` |
| Agent tasking guide | `docs/55-agent-tasking-guide.md` |
| Backlog | `docs/56-implementation-backlog.md` |
| Risks and ADRs | `docs/59-risks-and-decisions.md` |
