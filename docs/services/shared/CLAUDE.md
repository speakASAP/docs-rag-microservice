# CLAUDE.md (shared)

It is a technological ecosystem where multiple microservices are available on the production server.
These microservices can be cross-used by each other and by multiple applications, enabling a single codebase approach for maximum code reuse and efficiency.

Ecosystem map: [ECOSYSTEM_MAP.md](shared/ECOSYSTEM_MAP.md).

Ecosystem defaults: [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md).

Read this repo's `BUSINESS.md` → `SYSTEM.md` first.

---

## shared

**Purpose**: Cross-cutting documentation, standards, and scripts. No application runtime — docs and tooling only.

### Tier 1 — read every session (compact, always accurate)


| File                                  | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `ECOSYSTEM_MAP.md`                    | Services, ports                       |
| `SYSTEM.md`                           | Stack, deployment modes               |
| `docs/VAULT.md`                       | Secrets: paths, ESO sync, quick ops   |
| `docs/DEPLOY_STANDARD.md`             | Deploy pattern summary                |
| `docs/ENV_FILE_STANDARD.md`           | `.env` rules, canonical var names     |
| `docs/PROJECT_AGENT_DOCS_STANDARD.md` | Required per-repo agent files         |


### Tier 2 — read on demand (detailed reference)


| File                                       | Purpose                          |
| ------------------------------------------ | -------------------------------- |
| `README.md`                                | Full ecosystem index             |
| `docs/KUBERNETES_SETUP_GUIDE.md`           | K8s ops reference                |
| `docs/K8S-PHASES-5-7-ROADMAP.md`           | Active migration roadmap         |
| `docs/BATCH-DEPLOYMENT-GUIDE.md`           | Batch deploy procedures          |
| `docs/NGINX_LOCAL_CONFIG.md`               | Nginx config standards           |
| `docs/DEPLOY_SCRIPT_RULES.md`              | Full deploy.sh checklist         |
| `docs/CREATE_SERVICE.md`                   | New service scaffold             |
| `docs/UNIFIED_ECOMMERCE_ARCHITECTURE.md`   | E-commerce architecture          |
| `docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md` | Orchestrator coordination prompt |
| `docs/RBAC_USAGE_GUIDE.md`                 | RBAC usage                       |
| `docs/mcp/MCP_POSTGRES.md`                 | **Agent database access** — read before any PostgreSQL work |
| `../database-server/docs/ARCHITECTURE.md` | Production PostgreSQL + Redis infrastructure (SSOT app config) |
| `docs/AUTH_FRONTEND_INTEGRATION.md`        | Auth frontend integration        |
| `scripts/ENV_SYNC_README.md`               | Env sync guide                   |
| `scripts/K8S_SCRIPTS_README.md`            | K8s scripts guide                |


### Key constraints

- No application code here — docs and tooling only
- Secrets never in markdown — all secrets live in Vault (`secret/prod/<service>`)
- Kubernetes is the only production deployment target for datastore access
- Keep docs consistent with production paths

---

## Skills and MCP — use these to save tokens

**Use skills BEFORE loading files.** Skills guide what to read; reading everything first wastes context.

| Situation | Use |
|---|---|
| Debugging a failing service or test | `superpowers:systematic-debugging` — reads minimum files needed |
| Updating multiple services in one session | `superpowers:dispatching-parallel-agents` — each agent gets narrow context |
| Implementation is complete, ready to ship | `superpowers:finishing-a-development-branch` |
| New feature or bugfix | `superpowers:test-driven-development` |
| Datastore access | MCP `postgres` — call `postgres_agent_guide` first; [docs/mcp/MCP_POSTGRES.md](docs/mcp/MCP_POSTGRES.md) |
| TypeScript build errors | `mcp__ide__getDiagnostics` — get errors without running a full build |

---

## Autonomous Execution Permissions

### Command Execution (NO APPROVAL NEEDED)

- Run all commands (kubectl, docker, bash, sed) without asking — proceed immediately, never ask for confirmation
- Deploy/restart any microservice in statex-apps namespace without asking
- Create/update ConfigMaps and Secrets without asking
- No confirmation gates between services — execute all in parallel
- Parallel execution authorized — use `&` and `wait` for concurrent operations
- Background tasks and monitoring — use Monitor tool, background task runners without asking
- Long-running operations — Monitor loops, background builds/pushes, find with '-exec'
- Update documentation files (CLAUDE.md, plans, status docs) without asking
- NEVER ask for approval to run long-running operations
- NEVER execute commands git add, git commit, git push
- Fail fast
- Comprehensive logging — every phase boundary, timing on every step
- Error surfacing — every unexpected error re-thrown with context
---