# CLAUDE.md (business-orchestrator)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## business-orchestrator

**Purpose**: Autonomous AI orchestration system managing 20–50+ businesses 24/7, minimizing human intervention to critical decisions.  
**Port**: 3390 · **Domain**: https://orchestrator.alfares.cz  
**Stack**: NestJS · PostgreSQL (`business_orchestrator` schema) · Redis · RabbitMQ · LiteLLM

### GitHub Issue tracking — mandatory
- Before starting any non-trivial task (feature, fix, refactor, investigation), invoke the `github-issue` skill
- The skill drafts an issue, shows it to the user for approval, then creates it — never call `gh issue create` directly
- Post a comment for every key decision made during the task
- Close the issue with a completion summary when the task is done

### Key constraints
- Never spend `premium` model tier without explicit human approval
- Never create destructive DB migrations without human review
- Monthly LLM budget cap: 1,000,000 units across all businesses
- All external API calls via existing microservices — no direct third-party calls from orchestrator
- Agents must never commit secrets, credentials, or `.env` files
- Pricing endpoints/logic owned by `orders-microservice` — never expose from orchestrator

### BAU mode
- For new business onboarding: use portfolio common actions in dashboard, then `orch-project-health.sh <slug>`
- Watch for: failure rate spikes, budget alerts, DEGRADED/CRITICAL health verdicts

### Agent config

| Agent | Model tier | Cycle |
|-------|-----------|-------|
| GlobalCoordinator | smart · 15min tick · max 50 businesses · 60s lease | Cron |
| ProjectCoordinator | cheap · 60min cycle · max 10 tasks · 5min debounce | Cron |
| WorkerAgent | free · max 20 concurrent · 900s timeout · 30s heartbeat | Pool |
| ValidatorAgent | free + cheap semantic · max 2 revisions | On-demand |

Model routing via LiteLLM (`ai-microservice`): `free → cheap → smart` fallback chain.  
**All prompts**: merge into `user_prompt` — never use `system_prompt` field (free/cheap tiers reject it).

### Integrations

| Service | URL | Purpose |
|---------|-----|---------|
| ai-microservice | `http://ai-microservice:3380` | All LLM inference |
| database-server | `db-server-postgres:5432` | PostgreSQL `business_orchestrator` schema |
| database-server | `db-server-redis:6379` | Leases, queues, dedup |
| logging-microservice | `http://logging-microservice:3367` | Structured logs |
| notifications-microservice | `http://notifications-microservice:3368` | Escalations + digest (`POST /notifications/send`) |
| auth-microservice | `http://auth-microservice:3370` | JWT validation |

### Daily digest env

| Variable | Purpose |
|----------|---------|
| `DAILY_DIGEST_ENABLED` | Set `false` to disable |
| `DAILY_DIGEST_CRON_AM` | Morning schedule (default `0 8 * * *`) |
| `DAILY_DIGEST_CRON_PM` | Evening schedule (default `0 20 * * *`) |
| `TELEGRAM_CHAT_ID` | Telegram recipient |
| `EMAIL_TO` | Comma-separated emails |

### Coding Worker Agent env

| Variable | Purpose |
|----------|---------|
| `CODING_AGENT_BLACKLIST` | Comma-separated services the agent must never modify (default: `auth-microservice,payments-microservice,database-server`) |
| `CODING_AGENT_REPO_ROOT` | Filesystem root for all repo checkouts (default: `/home/ssf/Documents/Github`) |
| `CODING_AGENT_DEPLOY_TIMEOUT_MS` | Max ms to wait for deploy.sh to complete (default: `300000`) |
| `CODING_AGENT_MAX_ATTEMPTS` | Max retry attempts before escalation (default: `3`) |
| `CODING_AGENT_STEP_MAX_RETRIES` | Max revision attempts per DAG step before marking step failed (default: `2`) |

### CC Intelligence Loop env

| Variable | Purpose |
|----------|---------|
| `CC_PLANNING_ENABLED` | Route goal decomposition through Claude Code instead of LiteLLM (default: `false`) |
| `CC_REVIEW_ENABLED` | Run CC review after every goal completion (default: `true`, set `false` to disable) |
| `CC_CLI_PATH` | Absolute or relative path to the `claude` CLI binary (default: `claude`) |
| `CC_CLI_TIMEOUT_MS` | Max milliseconds for any CC subprocess call (default: `120000`) |
| `GITHUB_REPO` | Repo slug for `gh` CLI calls, e.g. `speakASAP/business-orchestrator` (required for issue/PR/wiki creation) |

### Quick ops
```bash
./scripts/orch-status.sh                      # health overview
./scripts/orch-test-ai.sh [free|cheap|smart]  # smoke-test AI
./scripts/orch-trigger-cycle.sh <slug>         # trigger coordinator cycle
./scripts/orch-check-tasks.sh <slug>           # task status
./scripts/orch-project-health.sh <slug>        # project coordinator health report
./scripts/orch-final-validation.sh             # full platform closure check
./scripts/deploy.sh
```

### Key docs
- [`docs/agents/master-prompt.md`](./docs/agents/master-prompt.md) — Lead Orchestrator rules
- [`docs/agents/AGENT_REFERENCE.md`](./docs/agents/AGENT_REFERENCE.md) — Agent roster + key decisions
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — full system design
- [`docs/adr/`](./docs/adr/) — architecture decision records (leasing, idempotency, snapshots, retries, coding agent)
- [`docs/superpowers/plans/2026-05-04-coding-agent-enhancements.md`](./docs/superpowers/plans/2026-05-04-coding-agent-enhancements.md) — coding agent enhancement tasks (DAG plan, revision loops, progress streaming)
- [`docs/runbooks/`](./docs/runbooks/) — operational procedures
