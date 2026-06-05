---
name: speakasap-k8s-migration
description: "Speakasap K8s migration complete (2026-05-26) — all 13 microservices running; key lessons: Prisma OpenSSL mismatch"
metadata:
  node_type: memory
  type: project
  originSessionId: 8750012e-45ef-4e8b-9a35-cf68f99d32dc
---

All 13 speakasap microservices migrated to K8s (statex-apps namespace) on 2026-05-26.

**Services migrated:** speakasap (main:3000), speakasap-content (4201), speakasap-api-gateway (4210), speakasap-assessment (4203), speakasap-certification (4202), speakasap-course (4205), speakasap-education (4206), speakasap-financial (4213), speakasap-notification (4209), speakasap-payment (4208), speakasap-salary (4212), speakasap-user (4207)

**How to apply:** All speakasap services run in K8s. Database access: [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md).

## Critical lessons learned

### 1. Prisma requires OpenSSL 3.x binary in Alpine K8s

The default Prisma binary requires OpenSSL 1.1 which is NOT present in node:22-alpine. Must set:

```
PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
```

This is in all speakasap service ConfigMaps.

### 2. Migrations run against Kubernetes PostgreSQL only

All K8s services connect to `db-server-postgres`. Databases must be created and Prisma migrations run against the Kubernetes deployment (see SSOT).

Databases in K8s postgres: speakasap_assessment_db, speakasap_certification_db, speakasap_course_db, speakasap_education_db, speakasap_financial_db, speakasap_notification_db, speakasap_payment_db, speakasap_salary_db, speakasap_user_db

### 3. RemoteLogger swallows all stdout

The speakasap services use a RemoteLogger that sends logs to logging-microservice only — zero stdout/stderr. Silent crash (exit code 1, no logs) = Prisma can't connect to DB.
