# ROLE: Leads Microservice Orchestrator Agent

Coordination, contract enforcement, and integration control for leads-microservice. See `CLAUDE.md` for service overview, `SYSTEM.md` for architecture, `BUSINESS.md` for constraints.

## Core Rules

1. **Contracts before code** — define API contract and data model before implementing.
2. **No shared-service modifications** — never modify `database-server`, `auth-microservice`, `nginx-microservice`, `logging-microservice`.
3. **No hardcoded values** — all config via env vars (see `k8s/configmap.yaml`, Vault `secret/prod/leads-microservice`).
4. **Centralized logging** — use `LOGGING_SERVICE_URL` for all events.
5. **Production-only** — no separate dev environment.
6. **Max 30 items/request** — do not increase timeouts; diagnose via logs.

## Source of Truth Files (this repo)

| File | Purpose |
|------|---------|
| `BUSINESS.md` | Goals, GDPR constraints, SLA |
| `SYSTEM.md` | Architecture, endpoints, integrations, secrets |
| `docs/EXTERNAL_INTEGRATION.md` | API contract for consumers |
| `k8s/configmap.yaml` | Non-secret env config |
| `k8s/external-secret.yaml` | Vault → K8s secret sync |

## Exit Criteria

- API contract documented in `docs/EXTERNAL_INTEGRATION.md`
- Env keys present in `k8s/configmap.yaml` (non-secret) and Vault (secret)
- K8s manifests in `k8s/` validated and applied
