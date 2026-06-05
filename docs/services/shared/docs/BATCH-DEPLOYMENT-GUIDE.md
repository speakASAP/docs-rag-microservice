# Batch Deployment Guide for Kubernetes Phases 5-7

## Overview

This guide explains how to deploy multiple services in parallel batches using automation scripts. The batch deployment system enables efficient, repeatable deployment of the remaining 15+ services across Phases 5, 6, and 7.

## Prerequisites

- K8s cluster running (k3s on alfares)
- kubectl configured and accessible
- All services have deployment.yaml in k8s/ directory
- All ConfigMaps and Secrets created (per Tasks 3-4)
- Docker images built and pushed to localhost:5000

## Scripts Overview

### batch-deploy.sh

**Location**: `/home/ssf/Documents/Github/shared/scripts/batch-deploy.sh`

**Purpose**: Deploy multiple services in sequence with health checks and rollout monitoring.

**Features**:
- Automatic manifest path detection (supports -microservice, -service, and plain names)
- Sequential deployment with health check verification
- Colored output for easy monitoring
- Rollout status tracking with configurable timeout
- Comprehensive summary report with failure tracking

**Usage**:
```bash
bash scripts/batch-deploy.sh service1 service2 service3 ...
```

**Example**:
```bash
bash scripts/batch-deploy.sh catalog-microservice notifications-microservice orders-microservice
```

**Environment Variables**:
- `NAMESPACE`: K8s namespace (default: statex-apps)
- `TIMEOUT`: Rollout timeout (default: 3m)

```bash
# Deploy with custom namespace and timeout
NAMESPACE=production TIMEOUT=5m bash scripts/batch-deploy.sh auth catalog
```

### validate-service-readiness.sh

**Location**: `/home/ssf/Documents/Github/shared/scripts/validate-service-readiness.sh`

**Purpose**: Pre-deployment validation to catch configuration issues before deployment.

**Checks**:
1. .env file exists
2. deployment.yaml exists and is syntactically valid
3. Container image is specified
4. ConfigMap and Secrets are referenced

**Usage**:
```bash
bash scripts/validate-service-readiness.sh service-name
```

**Example**:
```bash
bash scripts/validate-service-readiness.sh catalog-microservice
```

**Exit Codes**:
- 0: Service is ready for deployment
- 1: Service has critical issues

## Deployment Batches

The 15+ services are organized into deployment batches for organized rollout:

### Phase 5: Core Services (5 services)

**Batch 1 - Auth & Data**:
```bash
bash scripts/batch-deploy.sh \
  auth-microservice \
  catalog-microservice \
  orders-microservice \
  leads-microservice \
  logging-microservice
```

**Estimated time**: 5-7 minutes

### Phase 6: Extended Services (5 services)

**Batch 2 - Notifications & Business**:
```bash
bash scripts/batch-deploy.sh \
  notifications-microservice \
  payments-microservice \
  prompts-microservice \
  suppliers-microservice \
  warehouse-microservice
```

**Estimated time**: 5-7 minutes

### Phase 7: Infrastructure & AI (5+ services)

**Batch 3A - Core Infrastructure**:
```bash
bash scripts/batch-deploy.sh \
  vault-service \
  minio-service
```

**Batch 3B - Final Services**:
```bash
bash scripts/batch-deploy.sh \
  ai-microservice \
  marketing-microservice
```

**Estimated time**: 3-5 minutes per batch

## Pre-Deployment Validation

Validate all services in a batch before deployment:

```bash
# Validate Phase 5 services
bash scripts/validate-service-readiness.sh auth-microservice
bash scripts/validate-service-readiness.sh catalog-microservice
bash scripts/validate-service-readiness.sh orders-microservice
bash scripts/validate-service-readiness.sh leads-microservice
bash scripts/validate-service-readiness.sh logging-microservice

# Or create a quick validation loop
for svc in auth-microservice catalog-microservice orders-microservice leads-microservice logging-microservice; do
  bash scripts/validate-service-readiness.sh "$svc"
done
```

## Monitoring Deployments

### Watch pod status in real-time

```bash
# Watch all pods in statex-apps namespace
kubectl get pods -n statex-apps -w

# Watch specific service pods
kubectl get pods -n statex-apps -l app=catalog-microservice -w

# Watch across multiple services
kubectl get pods -n statex-apps -l "app in (catalog-microservice,orders-microservice)"
```

### Check deployment status

```bash
# Check rollout status of a service
kubectl rollout status deployment/catalog-microservice -n statex-apps

# Check all deployments
kubectl get deployments -n statex-apps

# Detailed deployment info
kubectl describe deployment catalog-microservice -n statex-apps
```

### View logs

```bash
# View logs from a deployment (last 50 lines)
kubectl logs -n statex-apps deployment/catalog-microservice --tail=50

# Stream logs in real-time
kubectl logs -n statex-apps deployment/catalog-microservice -f

# View logs from specific pod
kubectl logs -n statex-apps <pod-name>

# View all logs for a service from the last 5 minutes
kubectl logs -n statex-apps deployment/catalog-microservice --since=5m
```

## Troubleshooting

### Service fails to deploy

1. **Check the error message** from batch-deploy.sh
2. **Validate the service**:
   ```bash
   bash scripts/validate-service-readiness.sh catalog-microservice
   ```
3. **Check pod logs**:
   ```bash
   kubectl logs -n statex-apps deployment/catalog-microservice
   ```
4. **Describe the pod**:
   ```bash
   kubectl describe pod -n statex-apps -l app=catalog-microservice
   ```

### Common issues

#### Image pull failures
- **Cause**: Docker image not found in registry
- **Fix**: Build and push image to localhost:5000
  ```bash
  cd /home/ssf/Documents/Github/catalog-microservice
  docker build -t localhost:5000/catalog-microservice:latest .
  docker push localhost:5000/catalog-microservice:latest
  ```

#### CrashLoopBackOff
- **Cause**: Application startup error (usually missing env vars or DB connectivity)
- **Fix**: Check logs and ensure ConfigMap/Secrets are correctly created
  ```bash
  kubectl logs -n statex-apps deployment/catalog-microservice
  ```

#### Pending pods (resources)
- **Cause**: Insufficient K8s resources
- **Fix**: Check node resources
  ```bash
  kubectl top nodes
  kubectl top pods -n statex-apps
  ```

#### ConfigMap/Secret not found
- **Cause**: ConfigMap or Secret not created before deployment
- **Fix**: Create them first (per Tasks 3-4)
  ```bash
  # Apply ConfigMaps
  kubectl apply -f /home/ssf/Documents/Github/k8s-manifests/configmaps/*.yaml
  # Apply Secrets
  kubectl apply -f /home/ssf/Documents/Github/k8s-manifests/secrets/*.yaml
  ```

### Rollback a failed deployment

```bash
# Undo last deployment
kubectl rollout undo deployment/catalog-microservice -n statex-apps

# View rollout history
kubectl rollout history deployment/catalog-microservice -n statex-apps

# Rollback to specific revision
kubectl rollout undo deployment/catalog-microservice -n statex-apps --to-revision=2
```

## Advanced Usage

### Deploy with custom timeout

Some services may need longer to start (e.g., services with heavy initialization):

```bash
# Deploy with 5-minute timeout
TIMEOUT=5m bash scripts/batch-deploy.sh catalog-microservice orders-microservice
```

### Deploy to custom namespace

```bash
# Deploy to staging namespace
NAMESPACE=staging bash scripts/batch-deploy.sh catalog-microservice
```

### Dry-run before actual deployment

Test YAML syntax without applying:

```bash
# Validate manifest only
kubectl apply -f /home/ssf/Documents/Github/catalog-microservice/k8s/deployment.yaml --dry-run=client
```

### Check manifest differences

Before deploying, see what will change:

```bash
# Show what would be created/modified
kubectl diff -f /home/ssf/Documents/Github/catalog-microservice/k8s/deployment.yaml
```

## Performance Notes

- **Sequential deployment**: Scripts deploy services one-by-one (not in parallel) for safety and clarity
- **Typical batch time**: 5-7 minutes per batch of 5 services
- **Parallel alternative**: For experienced operators, multiple terminal sessions can run `batch-deploy.sh` on different batches simultaneously
- **Monitoring overhead**: Rollout status checks add 1-3 seconds per service

## Success Criteria

A successful batch deployment meets these criteria:

1. ✓ All services report "✓ Rollout successful" or "⚠ Rollout pending (pods running)"
2. ✓ Pod count matches expected replicas (default: 1)
3. ✓ Pods are in Running state
4. ✓ Health checks pass (HTTP 200 on /health endpoint)
5. ✓ Services are accessible via kubectl exec or internal DNS

## Example: Complete Phase 5 Deployment

```bash
#!/bin/bash
# Deploy Phase 5 with full validation and monitoring

cd /home/ssf/Documents/Github/shared

# Step 1: Validate all services
echo "=== Validating Phase 5 services ==="
for svc in auth-microservice catalog-microservice orders-microservice leads-microservice logging-microservice; do
  bash scripts/validate-service-readiness.sh "$svc" || exit 1
done

# Step 2: Deploy batch
echo "=== Deploying Phase 5 services ==="
bash scripts/batch-deploy.sh \
  auth-microservice \
  catalog-microservice \
  orders-microservice \
  leads-microservice \
  logging-microservice

# Step 3: Monitor
echo "=== Monitoring pods ==="
kubectl get pods -n statex-apps -w -l "app in (auth-microservice,catalog-microservice,orders-microservice,leads-microservice,logging-microservice)"
```

## File Locations Reference

| Script | Path |
|--------|------|
| batch-deploy.sh | `/home/ssf/Documents/Github/shared/scripts/batch-deploy.sh` |
| validate-service-readiness.sh | `/home/ssf/Documents/Github/shared/scripts/validate-service-readiness.sh` |
| This guide | `/home/ssf/Documents/Github/shared/docs/BATCH-DEPLOYMENT-GUIDE.md` |

## Support

For issues or questions:

1. Review the Troubleshooting section
2. Check recent deployment logs: `kubectl logs -n statex-apps deployment/<service>`
3. Review KUBERNETES_SETUP_GUIDE.md for cluster setup issues
4. Check K8S-PHASES-5-7-ROADMAP.md for phase-specific details
