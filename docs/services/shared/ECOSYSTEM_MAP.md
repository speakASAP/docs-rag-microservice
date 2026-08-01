# Ecosystem Map — Statex
>
> AI fast-lookup. Single source of truth. Read this first.

---

## 🎯 Migration Status (Updated 2026-07-18)

**Phase A (5 services):** ✅ Complete on k3s
**Phase B (4 services):** ✅ Complete
**Phases 5–7 (28 services):** ✅ Complete — all running in K8s
**Speakasap (13 services):** ✅ Complete — all speakasap microservices running in K8s (2026-05-26)
**Ingress:** ✅ Traefik v3 (hostNetwork) — ports 80/443
**TLS:** ✅ cert-manager + Cloudflare DNS-01 — wildcard `*.alfares.cz` via Let's Encrypt
**Secrets:** ✅ All in Vault → ESO → K8s Secrets (`statex-apps` namespace)
**Remaining in Docker (permanent):** vault-microservice (HashiCorp Vault), k8s-registry (image registry :5000)
**Database access (agents):** MCP `postgres` → `postgres_agent_guide` first ([docs/mcp/MCP_POSTGRES.md](docs/mcp/MCP_POSTGRES.md)). Infrastructure SSOT: [database-server/docs/ARCHITECTURE.md](../database-server/docs/ARCHITECTURE.md).
**Legacy (never migrating):** speakasap-portal — Django 1.11.2 legacy app on dedicated speakasap server

→ [K8s Roadmap](docs/K8S-PHASES-5-7-ROADMAP.md)

---

## Services

Folder names in `~/Documents/Github` may omit the `-service` suffix (e.g. `allegro/` → `allegro-service`). Non-service dirs (`logs/`, `codex-worktrees/`, agent tooling) are omitted.

| Service | Type | Port | Domain | Purpose |
|---------|------|------|--------|---------|
| **INFRASTRUCTURE** |
| database-server | infra | 5432/6379 | database-server.alfares.cz | Shared PostgreSQL + Redis; admin UI on :3390 (`database-server-frontend`) |
| vault-microservice | infra | 8200 | vault.alfares.cz | HashiCorp Vault secrets — **Docker permanent** (not K8s) |
| auth-microservice | infra | 3370/3372 | auth.alfares.cz | JWT auth, user management |
| logging-microservice | infra | 3367 | logging.alfares.cz | Centralized structured logging |
| monitoring-microservice | infra | 3395/3396 | monitoring.alfares.cz | Observability platform (API + dashboard); Grafana at grafana.alfares.cz |
| backups-microservice | infra | 3398 | backups.alfares.cz | Centralized backup management (DB, MinIO, K8s resources) |
| docs-rag-microservice | infra | 3397 | docs-rag.alfares.cz | Documentation RAG — semantic search over ecosystem knowledge for AI agents |
| notifications-microservice | infra | 3368 | notifications.alfares.cz | Email/Telegram/WhatsApp notifications |
| ai-microservice | infra | 3380 | ai.alfares.cz | LLM inference, NLP, ASR, Document AI |
| ai-microservice-ollama | infra | 11435 (Docker) / 11434 (systemd) | — | Local LLM (Ollama). Docker container on 11435; host systemd service on 11434. |
| minio-microservice | infra | 9000/9001 | minio.alfares.cz | S3-compatible file storage (console also at storage.alfares.cz) |
| **E-COMMERCE BACKBONE** |
| catalog-microservice | svc | 3200 | catalog.alfares.cz | Product catalog — source of truth |
| warehouse-microservice | svc | 3201 | warehouse.alfares.cz | Stock + inventory management |
| orders-microservice | svc | 3203 | orders.alfares.cz | Central order processing; **product list pricing** (suggestions, approve/reject) — orders domain, not payments |
| invoices-microservice | svc | 3204 | invoices.alfares.cz | Proforma + final tax invoices from order/payment lifecycle |
| payments-microservice | svc | 3468 | payments.alfares.cz | Payment capture (PayPal/Stripe/PayU/ComGate/FioBanka) — **not** catalog/list-price management |
| suppliers-microservice | svc | 3202 | suppliers.alfares.cz | Supplier API imports |
| **BUSINESS SERVICES** |
| leads-microservice | svc | 4400/4401 | leads.alfares.cz | Lead intake + CRM |
| marketing-microservice | svc | 4600/4601 | marketing.alfares.cz | Campaign + segmentation engine |
| prompts-microservice | svc | 4750/4751 | prompts.alfares.cz | Authenticated prompt CRUD and sharing |
| agentic-email-processing-system | svc | 3374 | aeps.alfares.cz | AI email triage + classification |
| business-process-control-plane | svc | 3375 | — (ClusterIP) | Process/policy/workflow registry; Holiday Discount pilot; no public ingress yet |
| allegro-service | svc | various | allegro.alfares.cz | Allegro marketplace integration (repo: `allegro/`) |
| aukro-service | svc | various | aukro.alfares.cz | Aukro marketplace integration (repo: `aukro/`) |
| bazos-service | svc | various | bazos.alfares.cz | Bazos classifieds automation (repo: `bazos/`) |
| heureka-service | svc | various | heureka.alfares.cz | Heureka XML feed generation (repo: `heureka/`) |
| **APPLICATIONS** |
| flipflop-service | app | various | flipflop.alfares.cz | E-commerce platform (Czech market) (repo: `flipflop/`) |
| chytrakoupe | app | 3000 | chytrakoupe.alfares.cz | Czech conversion storefront (ChytraKoupe) on FlipFlop commerce APIs |
| cliplot | app | 8080 | cliplot.alfares.cz | Czech e-commerce storefront (Cliplot) |
| rent-a-box | app | 3000/8000 | rent-a-box.alfares.cz | Self-storage MVP — Next.js web (:3000) + FastAPI (:8000) |
| crypto-ai-agent | app | various | crypto-ai-agent.alfares.cz | AI crypto portfolio management |
| marathon | app | various | marathon.alfares.cz | Intensive learning programs |
| sgiprealestate | app | 4300/4301 | sgiprealestate.alfares.cz | Real estate agency website (RU/EN/AR) — **Non-K8s** (no local repo / no runtime) |
| shop-assistant | app | 4500/4501 | shop-assistant.alfares.cz | AI voice/text shopping assistant |
| speakasap | app | 42xx | speakasap.alfares.cz | Online education platform — 13 microservices in K8s (main, content, api-gateway, assessment, certification, course, education, financial, notification, payment, salary, user) |
| speakasap-portal | app | 43xx | speakasap-portal | Education portal + lesson recordings — legacy Django on dedicated speakasap server |
| statex | app | various | alfares.cz | AI-powered business automation platform |
| school-committee | app | 4800 | strilkove.cz | Czech primary school parent committee platform (QR payments, tasks, feedback) |
| candidate-blueprism | app | 4850 | candidate-blueprism.alfares.cz | BluePrism candidate exercise — process flow assessment tool (static) |
| domain-research | app | 4860 | domain-research.alfares.cz | Domain suggestion, RDAP availability checks, watch/notify |
| ecosystem-console | app | 3000 | ecosystem-console.alfares.cz | Ecosystem console UI — **K8s only** (no local repo under Github/) |
| **ORCHESTRATION** |
| runlayer | orch | 3390/3391 | runlayer.alfares.cz | AI agent orchestration brain |
| goalkeeper | orch | 3392 | goalkeeper.alfares.cz | Telegram-first IPS-governed autonomous development control plane |
| **HUB** |
| shared | hub | — | — | Ecosystem docs, scripts, standards |
| k8s-manifests | hub | — | — | Shared Kubernetes manifests SSOT for `statex-apps` |
| vault | hub | — | — | Vault policies + AppRole bootstrap (not the Vault runtime) |
| company-evidence-platform-docs | hub | — | — | Product docs for company/supplier verification service (docs-only) |
| **STATIC** |
| rehtani | static | 4601 | rehtani.alfares.cz | Static site (Řehtání Četechovice) |
| statex-ecosystem | static | 4710/4711 | statex-ecosystem.alfares.cz | Next.js ecosystem catalog (blue/green) |

### Absent from workspace / no K8s runtime (do not treat as live)

| Name | Note |
|------|------|
| beauty | Listed historically; no local repo, no ingress |
| messenger | Listed historically; no local repo, no ingress |

## Integration Matrix

| Service uses → | auth | db | logging | notifications | ai | payments | catalog | orders | warehouse |
|----------------|------|----|---------|--------------|-----|---------|---------|--------|-----------|
| flipflop-service | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| chytrakoupe | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| cliplot | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| rent-a-box | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| crypto-ai-agent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| marathon | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| shop-assistant | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| school-committee | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| speakasap | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| statex | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| domain-research | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| allegro-service | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| aukro-service | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| bazos-service | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| heureka-service | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ |
| invoices-microservice | — | ✓ | ✓ | — | — | ✓ | — | ✓ | — |
| leads-microservice | — | ✓ | ✓ | — | — | — | — | — | — |
| marketing-microservice | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| prompts-microservice | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| agentic-email | — | ✓ | ✓ | — | ✓ | — | — | — | — |
| business-process-control-plane | — | ✓ | ✓ | — | — | — | — | — | — |
| runlayer | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| goalkeeper | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| backups-microservice | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| docs-rag-microservice | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |

## Event Bus (RabbitMQ)

| Event | Publisher | Consumers |
|-------|-----------|-----------|
| `order.created` | orders-microservice | warehouse, allegro, aukro, bazos, marketing, invoices |
| `order.updated` | orders-microservice | warehouse, allegro, aukro, bazos, invoices |
| `order.shipped` | orders-microservice | notifications |
| `stock.updated` | warehouse-microservice | allegro, aukro, bazos, heureka |
| `task.created` | runlayer | worker agents |
| `task.completed` | runlayer | logging, dashboard |
| `task.failed` | runlayer | logging, notifications |
| `project.updated` | runlayer | logging, dashboard |
| `business.escalated` | runlayer | notifications |

## Port Reference

```text
33xx core:        3367 logging | 3368 notifications | 3370/3372 auth | 3374 aeps | 3375 bpcp | 3380-3389 ai | 3390 runlayer (+ db-frontend ClusterIP) | 3392 goalkeeper | 3395/3396 monitoring | 3397 docs-rag | 3398 backups | 3468 payments | 8200 vault (Docker)
32xx e-commerce:  3200 catalog | 3201 warehouse | 3202 suppliers | 3203 orders | 3204 invoices
42xx speakasap:   42xx range (blue/green)
43xx legacy:      4300/4301 sgiprealestate (non-K8s)
44xx leads:       4400/4401 blue/green
45xx shop-assistant: 4500/4501 blue/green
46xx marketing+static: 4600/4601 marketing | 4601 rehtani
47xx catalog+prompts: 4710/4711 statex-ecosystem | 4750/4751 prompts
48xx community:   4800 school-committee | 4850 candidate-blueprism | 4860 domain-research
app storefronts:  3000 chytrakoupe / rent-a-box-web / ecosystem-console | 8000 rent-a-box-api | 8080 cliplot
```

## Quick Patterns

- **Internal URL**: `http://<service-name>:<PORT>` inside Kubernetes; database endpoints → [database-server/docs/ARCHITECTURE.md](../database-server/docs/ARCHITECTURE.md)
- **External URL**: `https://<domain>.alfares.cz`
- **Health check**: `GET /health` (all services)
- **Logging**: POST to `http://logging-microservice:3367` with `{service, level, msg, duration_ms, timestamp}`
- **Deploy**: `./scripts/deploy.sh` (Traefik v3 handles routing & TLS automatically on K8s)
- **Docs standard**: Each service root has `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json` — see [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md)
