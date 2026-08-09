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




### Tier 2 — read on demand (detailed reference)




### Key constraints

- No application code here — docs and tooling only
- Secrets never in markdown — all secrets live in Vault (`secret/prod/<service>`)
- Kubernetes is the only production deployment target for datastore access
- Keep docs consistent with production paths

---

## Skills and MCP — use these to save tokens

**Use skills BEFORE loading files.** Skills guide what to read; reading everything first wastes context.

|---|---|

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