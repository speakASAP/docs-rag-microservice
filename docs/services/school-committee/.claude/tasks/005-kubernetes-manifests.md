# Task 005: Kubernetes Manifests

**Status:** ready
**Epic:** EPIC-010 Deployment
**Depends on:** 004

## Context

The application runs on Kubernetes in the `statex-apps` namespace. K8s manifests must be complete and aligned with ecosystem standards before the first deploy. This task creates the full manifest set.

## Objective

Create all K8s manifests for `school-committee` in the `k8s/` directory, aligned with `docs/18-kubernetes-deployment.md` and the Statex ecosystem standard (namespace `statex-apps`, Traefik ingress, cert-manager TLS).

## Relevant docs

- `docs/18-kubernetes-deployment.md` — deployment requirements, health probes
- `shared/ECOSYSTEM_MAP.md` — namespace, ingress pattern
- `shared/k8s/templates/` — reference templates
- `SYSTEM.md` — ports, env vars, service URLs

## Files likely touched

- `k8s/configmap.yaml`
- `k8s/deployment.yaml`
- `k8s/service.yaml`
- `k8s/ingress.yaml`
- `k8s/external-secret.yaml` (from task 004, verify completeness)
- `scripts/deploy.sh` — build + push + apply script

## Implementation constraints

- Namespace: `statex-apps`
- Image: `localhost:5000/school-committee:latest`
- `imagePullPolicy: Always`
- Blue port: 4800
- Liveness probe: `GET /api/health/live` port 4800
- Readiness probe: `GET /api/health/ready` port 4800
- Resources: requests `128Mi` / `50m`, limits `512Mi` / `500m`
- Ingress: `ingressClassName: traefik`, annotation `cert-manager.io/cluster-issuer: letsencrypt-prod`
- Domain: `strilkove.cz`
- Labels on all resources: `app: school-committee`, `managed-by: k8s-migration`
- 2 replicas minimum (per docs/18)
- ConfigMap must NOT contain secret values

## Acceptance criteria

- [ ] `k8s/configmap.yaml` contains all non-sensitive env vars from SYSTEM.md
- [ ] `k8s/deployment.yaml` has liveness and readiness probes
- [ ] `k8s/deployment.yaml` uses `imagePullPolicy: Always`
- [ ] `k8s/deployment.yaml` has `replicas: 2`
- [ ] `k8s/deployment.yaml` references both configmap and secret via `envFrom`
- [ ] `k8s/service.yaml` exposes port 4800 as ClusterIP
- [ ] `k8s/ingress.yaml` has TLS for `strilkove.cz` with cert-manager annotation
- [ ] `scripts/deploy.sh` builds image, pushes, applies manifests, runs rollout status check
- [ ] `kubectl apply --dry-run=client -f k8s/` produces no errors

## Tests required

- Validation: `kubectl apply --dry-run=client -f k8s/ -n statex-apps` — no errors
- Validation: YAML linting passes on all manifests
- Verification (manual, post-deploy): `kubectl rollout status deployment/school-committee -n statex-apps`

## Do not

- Do not put secret values in ConfigMap
- Do not use `imagePullPolicy: IfNotPresent` (breaks rolling updates)
- Do not use `restartPolicy: Never` or custom restart policies
- Do not hardcode image tag (use `latest` with `Always` pull)
- Do not add NetworkPolicy in this task (separate task if needed)
