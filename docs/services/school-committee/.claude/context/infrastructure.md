# Context: Infrastructure

Source of truth: `docs/18-kubernetes-deployment.md`, `docs/19-vault-secrets.md`, `docs/11-existing-infrastructure-integration.md`

## Kubernetes

- Namespace: `statex-apps`
- Ingress: Traefik v3 with cert-manager TLS (`*.alfares.cz` wildcard)
- Secrets: Vault → ESO → K8s Secret (refresh 5min)
- Image registry: `localhost:5000/<service>:latest`
- Required probes: `/api/health/live` and `/api/health/ready`

## Ports

- Blue: 4800
- Green: 4801 (future blue/green if needed)

## Readiness checks (in /api/health/ready)

- auth-microservice reachable
- DB service reachable
- Vault secrets loaded (check for presence of required env vars)

## Vault secret paths

```
secret/prod/school-committee/auth
secret/prod/school-committee/db
secret/prod/school-committee/payments
secret/prod/school-committee/notifications
secret/prod/school-committee/storage
```

## Service URLs (cluster-internal)

```
auth-microservice:  http://auth-microservice.statex-apps.svc.cluster.local:3370
DB service:         db-server-postgres:5432 (see database-server/docs/ARCHITECTURE.md)
Logging:            http://logging-microservice.statex-apps.svc.cluster.local:3367
Notifications:      http://notifications-microservice.statex-apps.svc.cluster.local:3368
MinIO/Storage:      http://minio-microservice.statex-apps.svc.cluster.local:9000
```

## NetworkPolicy intent

- deny all egress except: auth, DB, logging, notifications, storage
- deny all ingress except from ingress controller
- no direct public access to internal services

## Logging format (send to logging-microservice)

```json
{
  "service": "school-committee",
  "level": "info|warn|error",
  "msg": "...",
  "request_id": "uuid",
  "route": "/api/...",
  "status_code": 200,
  "duration_ms": 42,
  "timestamp": "ISO8601"
}
```
