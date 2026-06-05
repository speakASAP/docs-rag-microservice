# Kubernetes Setup Guide — Statex Ecosystem

> **Status:** Phases 1–2 complete (2026-04-18). Phases 5–7 in progress — see [K8S-PHASES-5-7-ROADMAP.md](K8S-PHASES-5-7-ROADMAP.md).
> This is a **one-time setup reference** — cluster is already running. Jump to Troubleshooting or Useful Commands for day-to-day ops.

---

## Phase 1: k3s Cluster Installation (COMPLETE)

```bash
# 1.1 Install k3s
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644 --disable traefik

# 1.2 Configure kubectl
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# 1.3 Create namespaces
kubectl create namespace statex-apps
kubectl create namespace statex-infra
kubectl label namespace statex-apps managed-by=kubernetes
kubectl label namespace statex-infra managed-by=kubernetes

# 1.4 Configure local registry (containerd)
sudo cat > /etc/rancher/k3s/registries.yaml <<'EOF'
mirrors:
  localhost:5000:
    endpoint:
      - "http://localhost:5000"
EOF
sudo systemctl restart k3s

# 1.5 Start local registry (use a named volume so tags survive host reboot)
docker volume create k8s-registry-data 2>/dev/null || true
docker run -d --name local-registry --restart always -p 5000:5000 -v k8s-registry-data:/var/lib/registry registry:2
```

---

## Phase 2: K8s Infrastructure (COMPLETE)

```bash
# 2.1 Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=60s

# 2.2 ClusterIssuer for Let's Encrypt
cat > /tmp/cluster-issuer.yaml <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@alfares.cz
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
kubectl apply -f /tmp/cluster-issuer.yaml

# 2.3 nginx-ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx && helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace nginx-ingress --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30080 \
  --set controller.service.nodePorts.https=30443
```

---

## Phase 3: Service Migration Pattern

### K8s manifest scaffold (per service)

```
<service>/k8s/
├── secret.yaml            # GITIGNORED — sensitive env vars
├── configmap.yaml         # Non-sensitive config
├── deployment.yaml        # Deployment + health probes
├── service.yaml           # ClusterIP Service
└── ingress.yaml           # Ingress with TLS
```

### ConfigMap example (auth-microservice)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-microservice-config
  namespace: statex-apps
data:
  SERVICE_NAME: "auth-microservice"
  PORT: "3370"
  DB_HOST: "db-server-postgres"
  DB_PORT: "5432"
  DB_USER: "dbadmin"
  DB_NAME: "auth"
  LOG_LEVEL: "info"
```

### Deployment example (health probes + resource limits)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-microservice
  namespace: statex-apps
spec:
  replicas: 1
  selector:
    matchLabels:
      app: auth-microservice
  template:
    metadata:
      labels:
        app: auth-microservice
    spec:
      containers:
      - name: auth-microservice
        image: localhost:5000/auth-microservice:latest
        ports:
        - containerPort: 3370
        envFrom:
        - configMapRef:
            name: auth-microservice-config
        - secretRef:
            name: auth-microservice-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3370
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3370
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          limits:
            memory: "256Mi"
            cpu: "500m"
          requests:
            memory: "128Mi"
            cpu: "250m"
```

### Service example
```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-microservice
  namespace: statex-apps
spec:
  type: ClusterIP
  selector:
    app: auth-microservice
  ports:
  - port: 3370
    targetPort: 3370
```

### Ingress example
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: auth-microservice
  namespace: statex-apps
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - auth.alfares.cz
    secretName: auth-microservice-tls
  rules:
  - host: auth.alfares.cz
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: auth-microservice
            port:
              number: 3370
```

### Database connectivity

See [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md) — single source of truth for endpoints, ConfigMap values, and verification commands.

### Verify service deployment
```bash
kubectl get pods -n statex-apps
kubectl get svc -n statex-apps
kubectl get ingress -n statex-apps
kubectl logs -n statex-apps deployment/auth-microservice -f
kubectl port-forward -n statex-apps svc/auth-microservice 3370:3370
curl http://localhost:3370/health
```

---

## Troubleshooting

### Registry push fails (`connection refused`)
```bash
docker ps | grep registry
docker restart local-registry
curl http://localhost:5000/v2/_catalog
```

### Pod cannot resolve K8s DNS
```bash
kubectl get pods -n kube-system | grep coredns
kubectl exec -it <pod-name> -n statex-apps -- nslookup auth-microservice
```

### Pod cannot connect to database
```bash
kubectl exec -it <pod-name> -n statex-apps -- nc -zv db-server-postgres 5432
kubectl exec -n statex-apps deployment/db-server-postgres -- pg_isready -U dbadmin
```

### Certificate not issuing
```bash
kubectl logs -n cert-manager deployment/cert-manager -f
kubectl describe certificate -n statex-apps
kubectl get challenge -n statex-apps
```

---

## Useful Commands

```bash
# Cluster
kubectl cluster-info
kubectl get nodes -o wide

# Deployments
kubectl get deployments -n statex-apps
kubectl get pods -n statex-apps
kubectl describe pod <pod-name> -n statex-apps

# Logs
kubectl logs -n statex-apps deployment/<service-name> --tail=100 -f

# Exec into pod
kubectl exec -it <pod-name> -n statex-apps -- /bin/sh

# Port forward
kubectl port-forward -n statex-apps svc/<service-name> <local-port>:<service-port>

# Restart
kubectl rollout restart deployment/<service-name> -n statex-apps
kubectl rollout status deployment/<service-name> -n statex-apps

# Resources
kubectl top nodes
kubectl top pod -n statex-apps

# Apply / delete
kubectl apply -f <file>.yaml
kubectl delete -f <file>.yaml
```
