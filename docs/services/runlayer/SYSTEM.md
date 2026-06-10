# System: runlayer

**Product name (UI):** Project OS — operating system for multiple digital projects with agent workers and human approvals. See [docs/POSITIONING.md](docs/POSITIONING.md).

## Architecture

NestJS (TypeScript) microservice. Kubernetes (`statex-apps` namespace).  
**Port**: 3390 · **Domain**: https://runlayer.alfares.cz

Core modules:

- `businesses` — Business aggregate CRUD + quota management
- `projects` — Project aggregate + state snapshot management
- `agents` — Agent lifecycle, heartbeat monitor, pool management
- `tasks` — Task CRUD, state machine, assignment engine
- `executions` — Immutable execution records
- `coordinator` — GlobalCoordinator + ProjectCoordinator runtime
- `worker` — WorkerAgent pool, queue consumer
- `validator` — ValidatorAgent, JSON Schema + semantic validation
- `mcp-client` — MCP server connections (filesystem, postgres, git, playwright)
- `events` — RabbitMQ publisher/consumer
- `dashboard` — REST API + WebSocket for owner UI

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Pricing ownership boundary

`runlayer` must not expose pricing endpoints or pricing business logic.
Product list pricing and AI price suggestion/approval flow are owned by `orders-microservice`.
`payments-microservice` remains payments-only (sessions, captures, refunds, webhooks).

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/runlayer:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=runlayer -f`  
**Restart:** `kubectl rollout restart deployment/runlayer -n statex-apps`

## Integrations

| Service | URL | Purpose |
|---------|-----|---------|
| ai-microservice | `http://ai-microservice:3380` | All LLM inference |
| database-server | `db-server-postgres:5432` | PostgreSQL schema `runlayer` |
| database-server | `db-server-redis:6379` | Leases, queues, dedup |
| logging-microservice | `http://logging-microservice:3367` | All structured logs |
| notifications-microservice | `http://notifications-microservice:3368` | Owner escalation + digest (Telegram/email via `POST /notifications/send`) |
| auth-microservice | `http://auth-microservice:3370` | JWT validation |
| mcp-filesystem | local process | Project file read/write |
| postgres | MCP stdio server | Kubernetes-only DB discovery/query for agents |

## Current State

<!-- AI-maintained. Updated by ProjectCoordinator at end of each cycle. -->
Stage: production · Deploy: Kubernetes (`statex-apps`)

## Daily digest (env)

| Variable | Purpose |
|----------|---------|
| `DAILY_DIGEST_ENABLED` | Set `false` to disable both crons |
| `DAILY_DIGEST_CRON_AM` | Morning digest schedule (default `0 8 * * *`) |
| `DAILY_DIGEST_CRON_PM` | Evening digest schedule (default `0 20 * * *`) |
| `DAILY_DIGEST_CRON` | Legacy single-cron fallback when AM/PM unset |
| `TELEGRAM_CHAT_ID` | Telegram recipient for digest + escalations |
| `EMAIL_TO` | Comma-separated emails; empty skips email channel |

## Operations scripts

```bash
./scripts/orch-status.sh                     # health overview (start here)
./scripts/orch-test-ai.sh [free|cheap|smart] # smoke-test AI endpoint
./scripts/orch-trigger-cycle.sh <slug|uuid>  # trigger coordinator cycle
./scripts/orch-check-tasks.sh <slug|uuid>    # task status + summary
```

Full reference: [scripts/README-scripts.md](scripts/README-scripts.md)

## Known Issues

<!-- AI-maintained. Coordinator appends/resolves. -->

### Resolved — 2026-04-12

| Issue | Fix | File |
|-------|-----|------|
| Worker sent `system_prompt` → free-tier 400 rejection → WORKER_TIMEOUT | Merge into `user_prompt` | `src/worker/worker-agent.service.ts` |
| Validator: unknown natural-language criteria → hard fail | Route to LLM review | `src/validator/validator-agent.service.ts` |
| Validator: `semantic_review_unavailable` counted as failure | Return `[]` on catch | `src/validator/validator-agent.service.ts` |
| Validator `runSemanticReview`: separate `system_prompt` → rejection | Merge into `user_prompt` | `src/validator/validator-agent.service.ts` |
| Coordinator sent all failed tasks in prompt → Ollama timeout → 503 | Cap at last 5 | `src/coordinator/project-coordinator.service.ts` |
| LiteLLM `free` tier had no fallback | Add `free → cheap` fallback | `ai-microservice/litellm_config.yaml` |
