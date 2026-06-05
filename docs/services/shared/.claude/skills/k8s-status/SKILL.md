---
name: k8s-status
description: One-shot K8s fleet health check. Shows pod status, recent restarts, CrashLoopBackOff, and pending pods in the statex-apps namespace. Optionally filter to a single service. Usage: /k8s-status [service-name]
disable-model-invocation: true
---

Run a full health sweep of the Statex K8s fleet using the shared scripts.

Scripts live at `/home/ssf/Documents/Github/shared/scripts/`. All are executable and accept subcommands.

## Usage

```
/k8s-status                        # full fleet
/k8s-status auth-microservice      # single service
```

## Step 1: Quick health overview

```bash
bash /home/ssf/Documents/Github/shared/scripts/k8s-quick.sh health
```

## Step 2: Problem pods — CrashLoopBackOff, ImagePullBackOff, Pending

```bash
bash /home/ssf/Documents/Github/shared/scripts/k8s-quick.sh errors
```

## Step 3: Full monitor health (includes ESO, events, metrics)

```bash
bash /home/ssf/Documents/Github/shared/scripts/k8s-monitor.sh health
```

## Step 4: If a specific service was given — drill into it

```bash
bash /home/ssf/Documents/Github/shared/scripts/k8s-quick.sh describe <service-name>
bash /home/ssf/Documents/Github/shared/scripts/k8s-quick.sh logs <service-name>
```

## Step 5: Recent warning events

```bash
kubectl get events -n statex-apps --field-selector=type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -20
```

## Available script subcommands (for reference)

**k8s-quick.sh**: `health` | `pods` | `errors` | `resources` | `logs <svc>` | `describe <svc>` | `restart <svc>` | `rollback <svc>`

**k8s-monitor.sh**: `health` | `watch` | `metrics` | `alerts` | `services` | `events` | `report`

**k8s-deploy.sh**: `list` | `info <svc>` | `status <svc>` | `rollout status <svc>` | `history <svc>` | `scale <svc> <n>`

## Output format

Summarize findings as:

```
FLEET STATUS — statex-apps

✅ Running:   31
⚠️  Restarts:  <service> (N restarts)
❌ Problem:   <service> — CrashLoopBackOff / ImagePullBackOff / secret missing

WARNINGS (last 5 min):
  - ...

ACTION NEEDED: [none | specific remediation steps with exact commands]
```

If everything is healthy, say so clearly. If there are issues, give the exact fix command.
