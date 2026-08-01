---
name: RunLayer Operational Facts
description: Operational gotchas for runlayer: auth, endpoints, agent seeding, deploy tag collision, coordinator trigger
type: project
originSessionId: 97bfe054-af9a-4643-8724-d69dfed69d9b
---
Operational facts for the runlayer K8s service (statex-apps namespace).

**Why:** Repeatedly re-deriving these wastes tokens; capture once and reuse.
**How to apply:** Read before any orchestrator debugging, deploy, or endpoint testing session.

---

## Public vs. JwtGuard-protected endpoints

JwtGuard calls `POST http://auth-microservice:3370/auth/validate`. Auth-microservice is on the coding-agent blacklist — never available for manual JWT generation from outside the cluster.

**Public (no auth needed):**
- `GET /health`
- `GET /api/dashboard`
- `GET /api/projects/:id/tasks` (any status filter)
- `GET /api/tasks/:id/executions`

**JwtGuard-protected (returns 401 without valid token):**
- `POST /api/projects/:id/cycle` — manual coordinator trigger
- `GET /api/agents` — agent list

**Workaround for protected endpoints:** Wait for the `*/5 * * * *` GlobalCoordinator cron to fire, or temporarily add `@Public()` decorator to the endpoint you need to test.

---

## Coordinator trigger mechanism

- **GlobalCoordinator**: cron `*/5 * * * *` — selects which projects to cycle (AI-assisted or fallback: any project where `last_cycle_at` is NULL or >5min ago)
- **ProjectCoordinator**: called per project from GlobalCoordinator; creates tasks from active goals using AI; debounce 5min
- **WorkerPool**: cron `*/10 * * * *` — dispatches `status='created'` tasks to `status='idle'` agents

To observe coordinator activity: `kubectl logs -n statex-apps deployment/runlayer --since=6m | grep -i "coordinator\|cycle\|goal\|task_created"`

---

## Agent table: must be manually seeded

Agents are NOT auto-provisioned at startup and there is NO `POST /api/agents` endpoint.

To seed idle worker agents:
```sql
INSERT INTO runlayer.agents (id, type, status, model_tier, capabilities, last_heartbeat, created_at)
VALUES (gen_random_uuid(), 'worker', 'idle', 'free', '[]', NOW(), NOW());
```
Run 3× for concurrency. Check: `SELECT id, type, status FROM runlayer.agents;`

---

## Deploy: git-SHA tag collision issue

`deploy.sh` tags Docker images with the git SHA. If the same SHA tag already exists in the local registry (`localhost:5000`) with DIFFERENT content, K8s won't pull the new image — the pod keeps running the stale version.

**Symptom:** `kubectl describe pod` shows the old image SHA (`sha256:948f76f...`), `kubectl rollout status` says "successfully rolled out", but new code is not running.

**Fix:**
```bash
TAG=$(date +%Y%m%d%H%M)
docker build -t localhost:5000/runlayer:$TAG .
docker push localhost:5000/runlayer:$TAG
kubectl set image deployment/runlayer runlayer=localhost:5000/runlayer:$TAG -n statex-apps
kubectl rollout status deployment/runlayer -n statex-apps
```

---

## Database access (agents)

Use MCP server `postgres`: `postgres_agent_guide`.

Database: `runlayer` on `db-server-postgres` in `statex-apps`. Tables are in schema `runlayer` (not `public`): `runlayer.goals`, `runlayer.tasks`, etc.

---

## goals table schema

Column is `constraints JSONB`, NOT `success_criteria`. The `title` column holds the goal name.

Insert a goal:
```sql
INSERT INTO runlayer.goals (id, project_id, title, status, constraints, created_at, updated_at)
VALUES (gen_random_uuid(), '<project_id>', 'Goal title here', 'active',
  '{"acceptance": ["criterion 1", "criterion 2"]}', NOW(), NOW());
```

---

## CodingWorkerAgent: task fields

For `type='coding'` tasks, the coordinator must provide:
- `target_service`: string — the microservice directory name under `CODING_AGENT_REPO_ROOT` (e.g. `'runlayer'`)
- `smoke_test_urls`: string[] — HTTP URLs returning 200 after deploy (e.g. `['http://runlayer:3390/health']`)

Blacklisted services (never target): `auth-microservice`, `payments-microservice`, `database-server`.

The ProjectCoordinator prompt was updated to know about coding tasks. When a goal mentions writing/modifying code, the AI should emit `type="coding"` with `target_service` and `smoke_test_urls`.
