# Ecosystem Map — Statex
>
> AI fast-lookup. Single source of truth. Read this first.

---

## 🎯 Migration Status (Updated 2026-05-26)

**Phase A (5 services):** ✅ Complete on k3s  
**Phase B (4 services):** ✅ Complete  
**Phases 5–7 (28 services):** ✅ Complete — all running in K8s  
**Speakasap (13 services):** ✅ Complete — all speakasap microservices running in K8s (2026-05-26)  
**Ingress:** ✅ Traefik v3 (hostNetwork) — 31 ingresses, ports 80/443  
**TLS:** ✅ cert-manager + Cloudflare DNS-01 — wildcard `*.alfares.cz` via Let's Encrypt  
**Secrets:** ✅ All in Vault → ESO → K8s Secrets (`statex-apps` namespace)  
**Docker nginx:** ✅ Stopped — Traefik handles all traffic on ports 80/443
**Remaining in Docker (permanent):** vault-microservice (HashiCorp Vault), k8s-registry (image registry :5000)
**Database access (agents):** MCP `postgres` → [shared/docs/mcp/MCP_POSTGRES.md](docs/mcp/MCP_POSTGRES.md). Infrastructure SSOT: [database-server/docs/ARCHITECTURE.md](../database-server/docs/ARCHITECTURE.md).
**Legacy (never migrating):** speakasap-portal — Django 1.11.2 legacy app on dedicated speakasap server

→ [K8s Roadmap](docs/K8S-PHASES-5-7-ROADMAP.md)

---

## Services

| Service | Type | Port | Domain | Purpose |
|---------|------|------|--------|---------|
| **INFRASTRUCTURE** |
| nginx-microservice | infra | 80/443 | — | Reverse proxy, SSL, blue/green deployments |
| database-server | infra | 5432/6379 | — | Shared PostgreSQL + Redis |
| auth-microservice | infra | 3370/3372 | auth.alfares.cz | JWT auth, user management |
| logging-microservice | infra | 3367 | logging.alfares.cz | Centralized structured logging |
| monitoring-microservice | infra | 3395/3396 | monitoring.alfares.cz | Observability platform (API + dashboard); Grafana at grafana.alfares.cz |
| backups-microservice | infra | 3398 | backups.alfares.cz | Centralized backup management (DB, MinIO, K8s resources) |
| docs-rag-microservice | infra | 3397 | docs-rag.alfares.cz | Documentation RAG — semantic search over ecosystem knowledge for AI agents |
| notifications-microservice | infra | 3368 | notifications.alfares.cz | Email/Telegram/WhatsApp notifications |
| ai-microservice | infra | 3380 | ai.alfares.cz | LLM inference, NLP, ASR, Document AI |
| ai-microservice-ollama | infra | 11435 (Docker) / 11434 (systemd) | — | Local LLM (Ollama). Docker container on 11435; host systemd service on 11434. |
| minio-microservice | infra | 9000/9001 | minio.alfares.cz | S3-compatible file storage |
| messenger | infra | various | messenger.alfares.cz | Matrix messaging + LiveKit A/V |
| **E-COMMERCE BACKBONE** |
| catalog-microservice | svc | 3200 | catalog.alfares.cz | Product catalog — source of truth |
| warehouse-microservice | svc | 3201 | warehouse.alfares.cz | Stock + inventory management |
| orders-microservice | svc | 3203 | orders.alfares.cz | Central order processing; **product list pricing** (suggestions, approve/reject) — orders domain, not payments |
| payments-microservice | svc | 3468 | payments.alfares.cz | Payment capture (PayPal/Stripe/PayU/ComGate/FioBanka) — **not** catalog/list-price management |
| suppliers-microservice | svc | 3202 | supplier.alfares.cz | Supplier API imports |
| **BUSINESS SERVICES** |
| leads-microservice | svc | 4400/4401 | leads.alfares.cz | Lead intake + CRM |
| marketing-microservice | svc | 4600/4601 | — | Campaign + segmentation engine |
| prompts-microservice | svc | 4750/4751 | prompts.alfares.cz | Authenticated prompt CRUD and sharing |
| agentic-email-processing-system | svc | 3374/3375 | aeps.alfares.cz | AI email triage + classification |
| allegro-service | svc | various | allegro.alfares.cz | Allegro marketplace integration |
| aukro-service | svc | various | aukro.alfares.cz | Aukro marketplace integration |
| bazos-service | svc | various | bazos.alfares.cz | Bazos classifieds automation |
| heureka-service | svc | various | heureka.alfares.cz | Heureka XML feed generation |
| **APPLICATIONS** |
| flipflop-service | app | various | flipflop.alfares.cz | E-commerce platform (Czech market) |
| crypto-ai-agent | app | various | crypto-ai-agent.alfares.cz | AI crypto portfolio management |
| beauty | app | various | beauty.alfares.cz | Multi-tenant beauty salon franchise platform |
| marathon | app | various | marathon.alfares.cz | Intensive learning programs |
| sgiprealestate | app | 4300/4301 | sgiprealestate.alfares.cz | Real estate agency website (RU/EN/AR) — **Non-K8s** (config-only, no runtime) |
| shop-assistant | app | 4500/4501 | shop-assistant.alfares.cz | AI voice/text shopping assistant |
| speakasap | app | 42xx | speakasap.alfares.cz | Online education platform — 13 microservices in K8s (main, content, api-gateway, assessment, certification, course, education, financial, notification, payment, salary, user) |
| speakasap-portal | app | 43xx | speakasap-portal | Education portal + lesson recordings |
| statex | app | various | alfares.cz | AI-powered business automation platform |
| school-committee | app | 4800 | strilkove.cz | Czech primary school parent committee platform (QR payments, tasks, feedback) |
| **ORCHESTRATION** |
| runlayer | orch | 3390/3391 | runlayer.alfares.cz | AI agent orchestration brain |
| **HUB** |
| shared | hub | — | — | Ecosystem docs, scripts, standards |
| **STATIC** |
| rehtani | static | — | rehtani.alfares.cz | Static site (Řehtání Četechovice) |
| statex-ecosystem | static | 4710/4711 | statex-ecosystem.alfares.cz | Next.js ecosystem catalog (blue/green) |

## Integration Matrix

| Service uses → | auth | db | logging | notifications | ai | payments | catalog | orders | warehouse |
|----------------|------|----|---------|--------------|-----|---------|---------|--------|-----------|
| flipflop-service | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| crypto-ai-agent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| beauty | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| marathon | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| sgiprealestate | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| shop-assistant | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| school-committee | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| speakasap | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| statex | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| allegro-service | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| aukro-service | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| bazos-service | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| heureka-service | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ |
| leads-microservice | — | ✓ | ✓ | — | — | — | — | — | — |
| marketing-microservice | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| prompts-microservice | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| agentic-email | — | ✓ | ✓ | — | ✓ | — | — | — | — |
| runlayer | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| backups-microservice | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| docs-rag-microservice | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |

## Event Bus (RabbitMQ)

| Event | Publisher | Consumers |
|-------|-----------|-----------|
| `order.created` | orders-microservice | warehouse, allegro, aukro, bazos, marketing |
| `order.updated` | orders-microservice | warehouse, allegro, aukro, bazos |
| `order.shipped` | orders-microservice | notifications |
| `stock.updated` | warehouse-microservice | allegro, aukro, bazos, heureka |
| `task.created` | runlayer | worker agents |
| `task.completed` | runlayer | logging, dashboard |
| `task.failed` | runlayer | logging, notifications |
| `project.updated` | runlayer | logging, dashboard |
| `business.escalated` | runlayer | notifications |

## Port Reference

```text
33xx core microservices:  3367 logging | 3368 notifications | 3370/3372 auth | 3374/3375 email-agent | 3380-3389 ai | 3390/3391 orchestrator | 3395/3396 monitoring | 3397 docs-rag | 3398 backups | 3468 payments
32xx e-commerce:          3200 catalog | 3201 warehouse | 3202 suppliers | 3203 orders
42xx speakasap:           42xx range (blue/green)
43xx sgiprealestate:      4300/4301 blue/green
44xx leads:               4400/4401 blue/green
45xx shop-assistant:      4500/4501 blue/green
46xx marketing:           4600/4601 blue/green
47xx static+prompts:      4700/4701 rehtani | 4710/4711 statex-ecosystem | 4750/4751 prompts
48xx community apps:      4800 school-committee
```

## Quick Patterns

- **Internal URL**: `http://<service-name>:<PORT>` inside Kubernetes; database endpoints → [database-server/docs/ARCHITECTURE.md](../database-server/docs/ARCHITECTURE.md)
- **External URL**: `https://<domain>.alfares.cz`
- **Health check**: `GET /health` (all services)
- **Logging**: POST to `http://logging-microservice:3367` with `{service, level, msg, duration_ms, timestamp}`
- **Deploy**: `./scripts/deploy.sh` or `nginx-microservice/scripts/blue-green/deploy-smart.sh <service>`
- **Docs standard**: Each service root has `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json` — see [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md)
