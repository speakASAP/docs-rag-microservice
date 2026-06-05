---
name: deploy
description: Deploy a Statex microservice to production using its ./scripts/deploy.sh script. Confirms before deploying. Usage: /deploy <service-name>
---

The user wants to deploy a Statex microservice to production.

## Step 1 — Detect platform

```bash
IS_MAC=$([ "$(uname -s)" = "Darwin" ] && echo "true" || echo "false")
GITHUB_DIR=$([ "$IS_MAC" = "true" ] && echo "/Users/sergiystashok/Documents/GitHub" || echo "/home/ssf/Documents/Github")
```

## Step 2 — Identify service

Use the argument provided, or ask the user which service to deploy.

If no service name given, list all services that have a deploy script:

On Ubuntu:

```bash
find /home/ssf/Documents/Github -maxdepth 2 -name "deploy.sh" \
  | sed 's|/home/ssf/Documents/Github/||;s|/scripts/deploy.sh||' | sort
```

On Mac:

```bash
ssh alfares "find /home/ssf/Documents/Github -maxdepth 2 -name 'deploy.sh' \
  | sed 's|/home/ssf/Documents/Github/||;s|/scripts/deploy.sh||' | sort"
```

## Step 3 — Detect deployment type

Read the service's `scripts/deploy.sh` to understand how it deploys. K8s services (those with a `k8s/` directory) use `kubectl apply` + `kubectl rollout restart`. Legacy Kubernetes workloads use `nginx-microservice/scripts/blue-green/deploy-smart.sh`. Do not assume — always check the script first.

## Step 4 — Confirm

This is a production deployment. Always confirm:

> "About to deploy **\<service-name\>** to production via `./scripts/deploy.sh`. Proceed?"

Do not proceed without explicit confirmation.

## Step 5 — Deploy

On Ubuntu:

```bash
cd /home/ssf/Documents/Github/<service> && bash scripts/deploy.sh 2>&1 | tail -30
```

On Mac:

```bash
ssh alfares "cd /home/ssf/Documents/Github/<service> && bash scripts/deploy.sh 2>&1 | tail -30"
```

## Step 6 — Report

Show the final output lines. Report: **Deployment succeeded** or **Deployment failed** with the error.

If failed for a K8s service, suggest checking:
```bash
kubectl logs -n statex-apps -l app=<service> --tail=50
```

If failed for a legacy Kubernetes service, suggest checking:
```bash
docker logs <service>-blue --tail 50
```
