---
name: Use shared k8s scripts for K8s operations
description: Always use shared/scripts/k8s*.sh instead of raw kubectl chains for K8s work
type: feedback
originSessionId: cd89a511-ab95-4004-a133-d0c01ba79767
---
Use the shared k8s scripts for all K8s operations — don't wait to be told.

**Why:** Scripts exist at `shared/scripts/` with clean subcommand dispatch. Using them is more consistent and less verbose than raw kubectl chains.

**How to apply:**
- Health/pod checks → `k8s-quick.sh health` or `k8s-quick.sh errors`
- Restart a pod → `k8s-quick.sh restart <svc>`
- Rollout/history/scale → `k8s-deploy.sh status|rollout|scale <svc>`
- Full cluster health + ESO events → `k8s-monitor.sh health` or `k8s-monitor.sh alerts`
- Raw kubectl only when scripts don't cover the specific need (e.g. one-off jq queries, ExternalSecret annotations)
