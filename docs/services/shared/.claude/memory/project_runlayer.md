---
name: runlayer design status
description: Architecture spec for the runlayer microservice — central AI agent orchestration brain for the Statex ecosystem
type: project
---

Full architecture design is complete and saved at `~/Documents/GitHub/runlayer/`.

**Why:** System will be the central brain for 20–50+ autonomous businesses, managing AI agent hierarchy (GlobalCoordinator → ProjectCoordinator → Worker → Validator), tasks, state, and cost.

**How to apply:** When implementing runlayer, start from `docs/ARCHITECTURE.md` and respect the 4 ADRs (leasing, idempotency, snapshot-sync, retry-classes).

Key decisions:

- NestJS (TypeScript), port 3390/3391 (blue/green)
- PostgreSQL schema: `runlayer` on shared database-server
- Redis for leases (`bo:lease:*`), queues, dedup
- RabbitMQ for events (exchange: `runlayer`, topic)
- MCP servers: filesystem, postgres, git, playwright
- All LLM calls route through `ai-microservice` with model_tier hint (free/cheap/smart)
- `BUSINESS.md` is SHA256-hash-guarded — AI never modifies it
- `STATE.json` written only by ProjectCoordinator with optimistic lock (state_version)
