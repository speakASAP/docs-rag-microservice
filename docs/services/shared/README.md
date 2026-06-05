# Statex Microservices Ecosystem

A unified microservices architecture for building scalable, reusable applications.

---

## Vision

Multiple microservices on a production server, accessible via SSH or HTTPS. Cross-used by each other and by multiple applications — single codebase, maximum reuse.

---

## AI / Agents

- **Cursor IDE** (rules, hooks, MCP, skills): [docs/cursor/CURSOR_SETUP.md](docs/cursor/CURSOR_SETUP.md)
- **Per-repo agent files** (`BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json`): [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md)
- Open the **parent folder** as workspace; symlink `.cursor` → `shared/.cursor` so shared hooks apply across all repos.
- **`logs/` sibling:** not a service repo — no `BUSINESS.md` tree. See [docs/ops/logs-workspace-directory.md](docs/ops/logs-workspace-directory.md).

---

## Application List

<!-- markdownlint-disable MD060 -->
|        Application         | Auth | DB | Log | Nginx | Notify | Pay |
| -------------------------- | ---- | -- | --- | ----- | ------ | --- |
| **agentic-email-processing-system** | ✅ | ✅ | ✅ | ✅ | | |
| **allegro-service**        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **aukro-service**          | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **beauty**                 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **bazos-service**          | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **business-orchestrator**  | ✅ | ✅ | ✅ | ✅ | ✅ | |
| **crypto-ai-agent**        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ecosystem-console**      | — | — | — | ✅ | | |
| **flipflop-service**       | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **heureka-service**        | ✅ | ✅ | ✅ | ✅ | ✅ | |
| **marathon**               | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **messenger**              | ✅ | ✅ | ✅ | ✅ | | |
| **rehtani**                | — | — | — | ✅ | | |
| **prompts-microservice**   | ✅ | ✅ | ✅ | ✅ | | |
| **shop-assistant**         | ✅ | ✅ | ✅ | ✅ | | |
| **sgiprealestate**         | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **speakasap**              | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **speakasap-portal**       | ✅ | ✅ | ✅ | ✅ | | |
| **snake-game**             | — | — | — | ✅ | | |
| **statex**                 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **statex-ecosystem**       | — | — | — | ✅ | | |
| **tresinky_web**           | — | — | — | — | | |
<!-- markdownlint-enable MD060 -->

## Microservices List

| Microservice | DB | Log | Notify | Pay |
| ------------ | -- | --- | ------ | --- |
| **ai-microservice** | ✅ | ✅ | | |
| **auth-microservice** | ✅ | ✅ | | |
| **catalog-microservice** | ✅ | ✅ | | |
| **database-server** | | ✅ | | |
| **leads-microservice** | ✅ | ✅ | | |
| **marketing-microservice** | ✅ | ✅ | ✅ | |
| **logging-microservice** | | | | |
| **monitoring-microservice** | ✅ | ✅ | ✅ | |
| **minio-microservice** | | ✅ | | |
| **nginx-microservice** | | ✅ | | |
| **notifications-microservice** | ✅ | ✅ | | |
| **orders-microservice** | ✅ | ✅ | | |
| **payments-microservice** | ✅ | ✅ | ✅ | |
| **prompts-microservice** | ✅ | ✅ | | |
| **suppliers-microservice** | ✅ | ✅ | | |
| **warehouse-microservice** | ✅ | ✅ | | |

→ Ports, domains, K8s status: **[ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md)**

---

## K8s Migration Status

- **Phase A** (5 services): ✅ Running on k3s
- **Phase B** (4 services): ✅ Complete
- **Phases 5–7** (remaining services): 🔄 In progress
- **Secrets**: All in Vault → ESO → K8s Secrets (`statex-apps` namespace)

→ Roadmap: [docs/K8S-PHASES-5-7-ROADMAP.md](docs/K8S-PHASES-5-7-ROADMAP.md)

---

## Documentation

| Topic | File |
|-------|------|
| All services, ports, domains | [ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md) |
| Secret management (Vault) | [docs/VAULT.md](docs/VAULT.md) |
| New service scaffold | [docs/CREATE_SERVICE.md](docs/CREATE_SERVICE.md) |
| Deploy script standard | [docs/DEPLOY_STANDARD.md](docs/DEPLOY_STANDARD.md) |
| Full deploy.sh checklist | [docs/DEPLOY_SCRIPT_RULES.md](docs/DEPLOY_SCRIPT_RULES.md) |
| Nginx config standard | [docs/NGINX_LOCAL_CONFIG.md](docs/NGINX_LOCAL_CONFIG.md) |
| `.env` / Vault rules | [docs/ENV_FILE_STANDARD.md](docs/ENV_FILE_STANDARD.md) |
| K8s setup & ops | [docs/KUBERNETES_SETUP_GUIDE.md](docs/KUBERNETES_SETUP_GUIDE.md) |
| K8s migration roadmap | [docs/K8S-PHASES-5-7-ROADMAP.md](docs/K8S-PHASES-5-7-ROADMAP.md) |
| RBAC usage | [docs/RBAC_USAGE_GUIDE.md](docs/RBAC_USAGE_GUIDE.md) |
| Auth frontend integration | [docs/AUTH_FRONTEND_INTEGRATION.md](docs/AUTH_FRONTEND_INTEGRATION.md) |
| E-commerce architecture | [docs/UNIFIED_ECOMMERCE_ARCHITECTURE.md](docs/UNIFIED_ECOMMERCE_ARCHITECTURE.md) |
| Env sync scripts | [scripts/ENV_SYNC_README.md](scripts/ENV_SYNC_README.md) |
| K8s scripts | [scripts/K8S_SCRIPTS_README.md](scripts/K8S_SCRIPTS_README.md) |
| Per-repo agent doc standard | [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md) |
