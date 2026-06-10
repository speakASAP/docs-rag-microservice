# K8s Phases 5-7 Deployment Roadmap

**Last Updated:** 2026-05-05  
**Status:** ✅ COMPLETE — Full ecosystem migrated to Kubernetes  
**Scope:** All services migrated; roadmap retained as historical reference

---

## ✅ Final Migration Result (2026-05-05)

### What's Running in K8s (statex-apps namespace)
**28 pods, 31 Traefik ingresses — all healthy**

| Service | Domain | Notes |
|---------|--------|-------|
| ai-microservice | ai.alfares.cz | |
| allegro-service | allegro.alfares.cz | |
| aukro-service | aukro.alfares.cz | |
| auth-microservice | auth.alfares.cz | |
| bazos-service | bazos.alfares.cz | |
| runlayer | runlayer.alfares.cz | |
| catalog-microservice | catalog.alfares.cz | |
| crypto-ai-agent | crypto-ai-agent.alfares.cz | |
| ecosystem-console | ecosystem-console.alfares.cz | |
| flipflop-service | flipflop.alfares.cz | |
| heureka-service | heureka.alfares.cz | |
| leads-microservice | leads.alfares.cz | |
| logging-microservice | logging.alfares.cz | |
| marathon | marathon.alfares.cz | |
| minio-microservice | minio.alfares.cz | |
| notifications-microservice | notifications.alfares.cz | |
| orders-microservice | orders.alfares.cz | |
| payments-microservice | payments.alfares.cz | |
| prompts-microservice | prompts.alfares.cz | |
| shop-assistant | shop-assistant.alfares.cz | |
| speakasap | speakasap.alfares.cz | |
| statex | alfares.cz | |
| statex-ecosystem | statex-ecosystem.alfares.cz | |
| suppliers-microservice | supplier.alfares.cz | |
| warehouse-microservice | warehouse.alfares.cz | |

### Permanent Non-K8s (intentional)
| Component | Where | Reason |
|-----------|-------|--------|
| vault-microservice | Docker container | HashiCorp Vault — permanent Docker; unseals on boot |
| k8s-registry | Docker container | Local image registry :5000 — K8s pulls images from here |
| PostgreSQL :5432 | Kubernetes | See [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md) |
| Redis :6379 | Kubernetes | See [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md) |
| speakasap-portal | Dedicated speakasap server | Django 1.11.2 legacy — never migrating |

### Excluded / Skipped
| Service | Reason |
|---------|--------|
| marketing-microservice | No source code / Dockerfile exists; ingress placeholder only |
| speakasap-portal | Legacy Django on separate server; excluded by design |

### Infrastructure
- **Ingress:** Traefik v3 (hostNetwork) — 31 ingresses, handles ports 80/443
- **TLS:** cert-manager + Cloudflare DNS-01 — wildcard `*.alfares.cz` (Let's Encrypt)
- **Secrets:** HashiCorp Vault → ExternalSecret Operator → K8s Secrets (statex-apps)
- **Docker cleanup:** All 47 zombie Docker containers removed (overlay2 data was lost)
- **Vault unseal:** Key stored at `vault-microservice/.vault-init`; must unseal after host reboot

---

## Executive Summary

### Current Progress
- **Phase A (Complete):** 5 services ✅
  - allegro-service, aukro-service, bazos-service, flipflop-service, heureka-service
- **Phase B (Complete):** 4 services ✅
  - crypto-ai-agent, beauty-service, speakasap-service, statex-service
- **Phases 5-7 (Complete):** 15+ remaining services → all migrated

### Stack Composition
| Stack Type | Count | Services |
|-----------|-------|----------|
| Node.js/NestJS | 12 | ai, auth, catalog, leads, logging, marketing, notifications, orders, payments, prompts, suppliers, warehouse |
| Infrastructure/Proxy | 3 | minio (MinIO), nginx (Nginx proxy), vault (HashiCorp Vault) |


