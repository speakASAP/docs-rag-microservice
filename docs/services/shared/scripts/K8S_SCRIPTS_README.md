# Kubernetes Management and Monitoring Scripts

This directory contains a suite of Kubernetes management scripts for cluster operations, monitoring, and deployment management.

## Scripts Overview

### 1. **k8s-cluster-manager.sh**
Centralized cluster management tool for viewing cluster state, nodes, pods, services, and performing rollout operations.

**Key Commands:**
- `clusters` - List available Kubernetes contexts
- `status` - Overall cluster health status
- `nodes` - Node details and capacity
- `pods [filter]` - List and filter pods
- `services` - Service endpoints
- `deployments` - Deployment overview
- `rollout <action>` - Manage deployments (restart, pause, resume, undo)
- `logs <pod>` - Get pod logs
- `exec <pod>` - Execute commands in pods
- `debug <pod>` - Detailed pod debugging

**Usage Examples:**
```bash
./k8s-cluster-manager.sh status
./k8s-cluster-manager.sh pods allegro
./k8s-cluster-manager.sh rollout restart allegro-service
FOLLOW=true ./k8s-cluster-manager.sh logs my-pod
./k8s-cluster-manager.sh debug my-pod
```

### 2. **k8s-monitor.sh**
Real-time monitoring and health checking tool for cluster and service availability.

**Key Commands:**
- `health` - Complete health check
- `watch [filter]` - Real-time pod monitoring
- `metrics` - Resource usage metrics
- `alerts` - Check for issues (CrashLoop, ImagePull, etc.)
- `services` - Service connectivity check
- `events [limit]` - Recent cluster events
- `report` - Generate comprehensive health report

**Usage Examples:**
```bash
./k8s-monitor.sh health
./k8s-monitor.sh watch allegro true
./k8s-monitor.sh alerts
./k8s-monitor.sh metrics
./k8s-monitor.sh report
```

### 3. **k8s-deploy.sh**
Deployment management tool for rolling updates, scaling, and rollback operations.

**Key Commands:**
- `list` - List all deployments
- `info <deployment>` - Deployment details
- `update <deployment> <container> <image>` - Update image (with automatic rollout)
- `scale <deployment> <replicas>` - Scale replicas
- `status [deployment]` - Rollout status
- `history <deployment>` - Rollout history
- `compare <deployment>` - Current vs desired state
- `validate <deployment>` - Validate deployment health
- `rollout <action>` - Manual rollout operations

**Usage Examples:**
```bash
./k8s-deploy.sh list
./k8s-deploy.sh info allegro-service
./k8s-deploy.sh update allegro-service app localhost:5000/allegro-service:v2
./k8s-deploy.sh scale allegro-service 3
./k8s-deploy.sh status allegro-service
./k8s-deploy.sh validate allegro-service
./k8s-deploy.sh rollout undo allegro-service
```

## Environment Variables

All scripts respect the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `K8S_NAMESPACE` | `statex-apps` | Kubernetes namespace to operate on |
| `FOLLOW` | (unset) | Set to `true` to follow logs in streaming mode |
| `REFRESH_INTERVAL` | `5` | Refresh interval (seconds) for watch commands |
| `TIMEOUT` | `5m` | Timeout for rollout operations |

**Example:**
```bash
# Use different namespace
K8S_NAMESPACE=production ./k8s-cluster-manager.sh status

# Follow logs in real-time
FOLLOW=true ./k8s-cluster-manager.sh logs my-pod

# Faster monitor refresh
REFRESH_INTERVAL=2 ./k8s-monitor.sh watch allegro

# Longer deployment timeout
TIMEOUT=10m ./k8s-deploy.sh update my-deployment app new-image:tag
```

## Common Workflows

### 1. Health Check and Status
```bash
# Quick health check
./k8s-monitor.sh health

# Detailed cluster status
./k8s-cluster-manager.sh status

# All deployments status
./k8s-deploy.sh status

# Monitor for issues in real-time
./k8s-monitor.sh alerts
```

### 2. Deploying New Version
```bash
# Build and push new image (separately)
docker build -t localhost:5000/my-service:v2 .
docker push localhost:5000/my-service:v2

# Update deployment
./k8s-deploy.sh update my-deployment app localhost:5000/my-service:v2

# Automatically waits and shows status
# View full rollout history
./k8s-deploy.sh history my-deployment
```

### 3. Troubleshooting Failed Pods
```bash
# Check overall alerts
./k8s-monitor.sh alerts

# Get detailed info about specific pod
./k8s-cluster-manager.sh debug pod-name

# View recent logs
./k8s-cluster-manager.sh logs pod-name

# Stream logs
FOLLOW=true ./k8s-cluster-manager.sh logs pod-name

# Execute command in pod
./k8s-cluster-manager.sh exec pod-name /bin/sh
```

### 4. Scaling and Load Management
```bash
# Check current status
./k8s-deploy.sh info my-deployment

# Scale up
./k8s-deploy.sh scale my-deployment 5

# Scale down
./k8s-deploy.sh scale my-deployment 1

# Monitor scaling progress
./k8s-monitor.sh watch my-deployment
```

### 5. Rollback Failed Deployment
```bash
# Check deployment history
./k8s-deploy.sh history my-deployment

# Rollback to previous version
./k8s-deploy.sh rollout undo my-deployment

# Or rollback to specific revision
./k8s-deploy.sh rollout undo my-deployment 3

# Verify rollback
./k8s-deploy.sh status my-deployment
```

## Logging and Reports

All scripts write logs to `../logs/` directory:

- `k8s-manager.log` - Cluster manager operations
- `k8s-deploy.log` - Deployment operations
- `k8s-monitor.log` - Monitor operations (if any)
- `k8s-health-report-YYYYMMDD-HHMMSS.txt` - Generated reports

**View logs:**
```bash
tail -f ../logs/k8s-manager.log
./k8s-monitor.sh report  # Generates timestamped report
```

## Best Practices

1. **Always check health before deployments:**
   ```bash
   ./k8s-monitor.sh health
   ./k8s-deploy.sh update ...
   ```

2. **Monitor during deployments:**
   ```bash
   # In one terminal
   ./k8s-monitor.sh watch my-service true
   
   # In another terminal
   ./k8s-deploy.sh update my-deployment app new-image:tag
   ```

3. **Keep rollout history:**
   - Never force-delete pods (let controllers manage them)
   - Use `rollout undo` instead of manual rollbacks
   - Check history before major changes

4. **Check alerts regularly:**
   ```bash
   # Set up cron job or monitoring
   ./k8s-monitor.sh alerts
   ```

5. **Generate health reports periodically:**
   ```bash
   # Run reports before and after changes
   ./k8s-monitor.sh report
   ```

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```bash
#!/bin/bash
# deploy.sh example

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
K8S_DEPLOY="$SCRIPT_DIR/../scripts/k8s-deploy.sh"

DEPLOYMENT="my-service"
IMAGE="$DOCKER_REGISTRY/$DEPLOYMENT:$CI_COMMIT_SHA"

# Validate cluster health
"$K8S_DEPLOY" validate "$DEPLOYMENT" || {
    echo "Deployment not healthy, aborting"
    exit 1
}

# Update with new image
"$K8S_DEPLOY" update "$DEPLOYMENT" app "$IMAGE"

# Verify result
"$K8S_DEPLOY" status "$DEPLOYMENT"
```

## Troubleshooting

### "Command not found"
Make sure scripts are executable:
```bash
chmod +x k8s-*.sh
```

### "Unable to connect to server"
Check kubeconfig and current context:
```bash
./k8s-cluster-manager.sh context show
./k8s-cluster-manager.sh clusters
```

### "Metrics not available"
Metrics server may not be installed:
```bash
kubectl get deployment metrics-server -n kube-system
# If not present, install with:
# kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### "Permission denied"
Check RBAC permissions for your user:
```bash
kubectl auth can-i get pods
kubectl auth can-i list deployments
kubectl auth can-i patch deployments
```

## See Also

- Kubernetes Documentation: https://kubernetes.io/docs/
- kubectl Cheat Sheet: https://kubernetes.io/docs/reference/kubectl/cheatsheet/
- CLAUDE.md for project-specific K8s configuration
- deploy.sh scripts in individual service directories

