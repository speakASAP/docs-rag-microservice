# Checklist: Deployment Review

Source: `docs/18-kubernetes-deployment.md`, `docs/19-vault-secrets.md`

## Before deploying

- [ ] Docker image builds successfully: `docker build -t localhost:5000/school-committee:latest .`
- [ ] `npm test` passes in CI/locally
- [ ] `npx tsc --noEmit` passes
- [ ] No secrets in Dockerfile or image layers

## Vault

- [ ] All required secrets written to Vault paths under `secret/prod/school-committee/`
- [ ] ExternalSecret resource has entry for every secret key used in the app
- [ ] `kubectl get externalsecret school-committee-secret -n statex-apps` shows `SecretSynced`

## K8s manifests

- [ ] `k8s/configmap.yaml` has all non-sensitive env vars
- [ ] `k8s/external-secret.yaml` has all secret keys
- [ ] `k8s/deployment.yaml` uses `imagePullPolicy: Always`
- [ ] `k8s/deployment.yaml` has liveness probe: `/api/health/live`
- [ ] `k8s/deployment.yaml` has readiness probe: `/api/health/ready`
- [ ] `k8s/deployment.yaml` has resource requests and limits
- [ ] `k8s/service.yaml` exposes port 4800
- [ ] `k8s/ingress.yaml` has TLS and cert-manager annotation

## Deploy steps

```bash
docker build -t localhost:5000/school-committee:latest .
docker push localhost:5000/school-committee:latest
kubectl apply -f k8s/external-secret.yaml -n statex-apps
kubectl apply -f k8s/configmap.yaml -n statex-apps
kubectl apply -f k8s/ -n statex-apps
kubectl rollout status deployment/school-committee -n statex-apps
```

## Post-deploy verification

- [ ] `kubectl get pods -n statex-apps -l app=school-committee` — STATUS Running
- [ ] `curl https://strilkove.cz/api/health/live` — 200 OK
- [ ] `curl https://strilkove.cz/api/health/ready` — 200 OK
- [ ] Check logs: `kubectl logs -n statex-apps -l app=school-committee --tail=50`
- [ ] No ERROR-level log lines on startup

## Rollback

```bash
kubectl rollout undo deployment/school-committee -n statex-apps
```
