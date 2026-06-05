# Kubernetes Deployment

## Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: school-platform
```

## Recommended workloads

```text
frontend-web
bff-api
notification-worker
```

For MVP, frontend and BFF may be one Next.js deployment.

## Deployment requirements

- 2 replicas minimum in production
- readiness probe
- liveness probe
- resource requests and limits
- rolling updates
- TLS ingress
- secrets from Vault
- structured logs

## Example deployment skeleton

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: school-platform-web
  namespace: school-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: school-platform-web
  template:
    metadata:
      labels:
        app: school-platform-web
    spec:
      containers:
        - name: web
          image: registry.example.com/school-platform-web:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: school-platform-secrets
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3000
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

## Ingress

Requirements:

- HTTPS only
- HSTS
- request size limits for uploads
- rate limits for public endpoints

## Health endpoints

```http
GET /api/health/live
GET /api/health/ready
```

Readiness checks:

- auth service reachable
- DB service reachable
- Vault secrets loaded
- notification service optional

## ConfigMap

Non-sensitive configuration:

```yaml
APP_BASE_URL
SUPPORTED_LOCALES
DEFAULT_LOCALE
PUBLIC_REPORT_CACHE_TTL_SECONDS
```

## Secrets

Sensitive values must come from Vault:

- service API tokens
- payment account config if considered sensitive
- webhook secrets
- SMTP credentials

## NetworkPolicy

Recommended:

- deny all by default
- allow ingress to frontend from ingress controller
- allow BFF egress to auth, DB, notification, Vault
- block direct public DB access

## Rollback

Every deployment must support:

```text
kubectl rollout undo deployment/school-platform-web
```

## Logging

Use JSON logs with:

- timestamp
- level
- request_id
- user_id hashed or omitted if not needed
- route
- status
- duration_ms
- error_code
