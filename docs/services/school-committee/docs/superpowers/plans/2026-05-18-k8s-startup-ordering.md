# K8s Startup Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure infrastructure services (Postgres, Redis) start before core services (auth, logging), which start before microservices (orders, warehouse, etc.), which start before apps (school-committee, statex, speakasap, prompts) — and fix school-committee replicas from 2 to 1.

**Architecture:** Add `initContainers` to each deployment that block the main container until its dependencies are reachable via TCP. Each initContainer runs a `busybox` loop (`nc -z <host> <port>`) and retries every 2 seconds. No external operators or CRDs needed — pure native K8s.

**Tech Stack:** Kubernetes initContainers, busybox:1.36, `nc` (netcat), `kubectl apply`

---

## Dependency Map

```
Tier 1 (no deps):    db-server-postgres (:5432), db-server-redis (:6379)
Tier 2 (wait Tier 1): auth-microservice, logging-microservice
Tier 3 (wait Tier 2): orders-microservice, warehouse-microservice, catalog-microservice, payments-microservice, suppliers-microservice
Tier 4 (wait Tier 2): school-committee, statex, speakasap, prompts-microservice
```

## Files Modified

| File | Change |
|------|--------|
| `school-committee/k8s/deployment.yaml` | replicas 2→1, add initContainers (wait postgres + auth + logging) |
| `auth-microservice/k8s/deployment.yaml` | add initContainers (wait postgres + redis) |
| `logging-microservice/k8s/deployment.yaml` | add initContainers (wait postgres) |
| `orders-microservice/k8s/deployment.yaml` | add initContainers (wait postgres + auth + logging) |
| `warehouse-microservice/k8s/deployment.yaml` | add initContainers (wait postgres + auth + logging) |
| `statex/k8s/deployment.yaml` | add initContainers (wait postgres) |
| `prompts-microservice/k8s/deployment.yaml` | add initContainers (wait postgres + auth + logging) |
| `speakasap/k8s/deployment.yaml` | add initContainers (wait postgres + auth) |

---

## Task 1: Fix school-committee replicas and add initContainers

**Files:**
- Modify: `school-committee/k8s/deployment.yaml`

school-committee depends on: `db-server-postgres:5432`, `auth-microservice:3370`, `logging-microservice:3367`

- [ ] **Step 1: Edit school-committee/k8s/deployment.yaml**

Change `replicas: 2` to `replicas: 1` AND add `initContainers` block. The full `spec.template.spec` section should look like this:

```yaml
spec:
  replicas: 1
  selector:
    matchLabels:
      app: school-committee
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: school-committee
    spec:
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-auth
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z auth-microservice 3370; do echo waiting for auth; sleep 2; done']
        - name: wait-logging
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z logging-microservice 3367; do echo waiting for logging; sleep 2; done']
      containers:
        - name: app
          ...
```

- [ ] **Step 2: Apply to cluster**

```bash
kubectl apply -f /home/ssf/Documents/Github/school-committee/k8s/deployment.yaml -n statex-apps
```

Expected output: `deployment.apps/school-committee configured`

- [ ] **Step 3: Verify**

```bash
kubectl get pods -n statex-apps -l app=school-committee
```

Expected: 1 pod (not 2), status Running or Init

---

## Task 2: Add initContainers to auth-microservice

**Files:**
- Modify: `auth-microservice/k8s/deployment.yaml`

auth-microservice depends on: `db-server-postgres:5432`, `db-server-redis:6379`

- [ ] **Step 1: Edit auth-microservice/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before the `containers:` key:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-redis
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-redis 6379; do echo waiting for redis; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/auth-microservice:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/auth-microservice/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/auth-microservice configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/auth-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "auth-microservice" successfully rolled out`

---

## Task 3: Add initContainers to logging-microservice

**Files:**
- Modify: `logging-microservice/k8s/deployment.yaml`

logging-microservice depends on: `db-server-postgres:5432`

- [ ] **Step 1: Edit logging-microservice/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/logging-microservice:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/logging-microservice/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/logging-microservice configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/logging-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "logging-microservice" successfully rolled out`

---

## Task 4: Add initContainers to orders-microservice

**Files:**
- Modify: `orders-microservice/k8s/deployment.yaml`

orders-microservice depends on: `db-server-postgres:5432`, `auth-microservice:3370`, `logging-microservice:3367`

- [ ] **Step 1: Edit orders-microservice/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-auth
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z auth-microservice 3370; do echo waiting for auth; sleep 2; done']
        - name: wait-logging
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z logging-microservice 3367; do echo waiting for logging; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/orders-microservice:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/orders-microservice/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/orders-microservice configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/orders-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "orders-microservice" successfully rolled out`

---

## Task 5: Add initContainers to warehouse-microservice

**Files:**
- Modify: `warehouse-microservice/k8s/deployment.yaml`

warehouse-microservice depends on: `db-server-postgres:5432`, `auth-microservice:3370`, `logging-microservice:3367`

- [ ] **Step 1: Edit warehouse-microservice/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-auth
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z auth-microservice 3370; do echo waiting for auth; sleep 2; done']
        - name: wait-logging
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z logging-microservice 3367; do echo waiting for logging; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/warehouse-microservice:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/warehouse-microservice/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/warehouse-microservice configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/warehouse-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "warehouse-microservice" successfully rolled out`

---

## Task 6: Add initContainers to statex

**Files:**
- Modify: `statex/k8s/deployment.yaml`

statex uses `DB_HOST=db-server-postgres` (Kubernetes service DNS, not cluster service). Wait on the Kubernetes service DNS directly.

- [ ] **Step 1: Edit statex/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/statex:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/statex/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/statex configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/statex -n statex-apps --timeout=120s
```

Expected: `deployment "statex" successfully rolled out`

---

## Task 7: Add initContainers to prompts-microservice

**Files:**
- Modify: `prompts-microservice/k8s/deployment.yaml`

prompts-microservice uses `DB_HOST=db-server-postgres` (Kubernetes service DNS) but auth and logging via cluster DNS.

- [ ] **Step 1: Edit prompts-microservice/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-auth
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z auth-microservice 3370; do echo waiting for auth; sleep 2; done']
        - name: wait-logging
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z logging-microservice 3367; do echo waiting for logging; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/prompts-microservice:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/prompts-microservice/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/prompts-microservice configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/prompts-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "prompts-microservice" successfully rolled out`

---

## Task 8: Add initContainers to speakasap

**Files:**
- Modify: `speakasap/k8s/deployment.yaml`

speakasap uses `DB_HOST=db-server-postgres` and `AUTH_SERVICE_URL=http://auth-microservice:3370` via Kubernetes service DNS.

- [ ] **Step 1: Edit speakasap/k8s/deployment.yaml**

Add `initContainers` block inside `spec.template.spec`, before `containers:`:

```yaml
      initContainers:
        - name: wait-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z db-server-postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-auth
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z auth-microservice 3370; do echo waiting for auth; sleep 2; done']
      containers:
        - name: app
          image: localhost:5000/speakasap:latest
```

- [ ] **Step 2: Apply**

```bash
kubectl apply -f /home/ssf/Documents/Github/speakasap/k8s/deployment.yaml -n statex-apps
```

Expected: `deployment.apps/speakasap configured`

- [ ] **Step 3: Verify**

```bash
kubectl rollout status deployment/speakasap -n statex-apps --timeout=120s
```

Expected: `deployment "speakasap" successfully rolled out`

---

## Task 9: Final verification — simulate reboot behavior

- [ ] **Step 1: Check all modified deployments have initContainers**

```bash
for svc in school-committee auth-microservice logging-microservice orders-microservice warehouse-microservice statex prompts-microservice speakasap; do
  echo "=== $svc ==="
  kubectl get deployment $svc -n statex-apps -o jsonpath='{range .spec.template.spec.initContainers[*]}{.name}{"\n"}{end}' 2>/dev/null
done
```

Expected: each service shows its wait-* initContainer names.

- [ ] **Step 2: Check school-committee has 1 replica**

```bash
kubectl get deployment school-committee -n statex-apps -o jsonpath='{.spec.replicas}'
```

Expected: `1`

- [ ] **Step 3: Check no pods are in high-restart state**

```bash
kubectl get pods -n statex-apps -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .status.containerStatuses[*]}{.restartCount}{end}{"\n"}{end}' | sort -t$'\t' -k2 -rn | head -10
```

Expected: restart counts stable (not climbing). On next reboot these will stay at 0.

- [ ] **Step 4: Verify school-committee health**

```bash
curl -s https://strilkove.cz/api/health/live
```

Expected: `{"status":"ok"}` or similar healthy response.
