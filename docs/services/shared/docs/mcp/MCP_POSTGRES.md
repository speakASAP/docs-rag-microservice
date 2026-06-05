# Agent Database Access — Statex Ecosystem

> **Mandatory for every AI agent** (Cursor, Claude Code, Codex, etc.) before any PostgreSQL work.
> This is the only supported access path. Follow it exactly — do not experiment with alternatives.

Infrastructure details for app configuration: [database-server/docs/ARCHITECTURE.md](../../../database-server/docs/ARCHITECTURE.md)

---

## Quick start (first try)

1. **Enable MCP server** `postgres` (see [Setup](#setup) — once per machine).
2. **First tool call, always:** `postgres_agent_guide` — no exceptions.
3. **Verify access:** `postgres_health_check` — stop if `ok: false`.
4. **Resolve database name:**
   - `postgres_database_catalog({ service: "<repo-name>" })` — e.g. `auth-microservice`
   - or `postgres_list_databases({ filter: "<partial-name>" })`
5. **Schema discovery (if needed):** `postgres_list_tables({ database: "<db>" })`
6. **Query data:** `postgres_query({ database: "<db>", sql: "SELECT ..." })` — read-only by default

**Server:** `shared/mcp/postgres-mcp/server.js` · requires `kubectl` + namespace `statex-apps`

---

## Production database (Kubernetes only)

PostgreSQL 15 runs **only** in Kubernetes namespace `statex-apps`.

| Field | Value |
| --- | --- |
| Short host (from pods in `statex-apps`) | `db-server-postgres` |
| Full DNS | `db-server-postgres.statex-apps.svc.cluster.local` |
| Port | `5432` |
| Admin user (MCP queries) | `dbadmin` |
| Deployment | `deployment/db-server-postgres` |
| Manifest | `database-server/k8s/in-cluster-databases.yaml` |

Redis (same namespace): `db-server-redis:6379` — see ARCHITECTURE.md for app config.

**How MCP reaches PostgreSQL:** `kubectl exec` into the `db-server-postgres` deployment in `statex-apps`.

---

## Forbidden — do not try these first

These waste tokens and fail in production:

| Wrong approach | Why it fails |
| --- | --- |
| `psql` on the host / `localhost:5432` | PostgreSQL is not exposed on the host |
| `kubectl port-forward` + local psql | Not the agent workflow; use MCP tools |
| Reading `DB_PASSWORD` from `.env` | Secrets live in Vault → ESO → K8s Secrets; MCP handles access |
| Generic third-party postgres MCP servers | Use ecosystem server `postgres` only |
| Constructing `DATABASE_URL` from grep/Vault | Use MCP discovery tools instead |
| Connecting via host IP or `127.0.0.1` | No production listener on the host |

If `postgres_health_check` fails, fix kubectl/cluster access — do not fall back to the approaches above.

---

## MCP tools

| Tool | When to call |
| --- | --- |
| `postgres_agent_guide` | **Always first** — returns workflow + forbidden list |
| `postgres_health_check` | Before any query — verifies kubectl + deployment |
| `postgres_database_catalog` | Map service repo → database name (from K8s manifests) |
| `postgres_list_databases` | Live database list from cluster |
| `postgres_list_tables` | Tables in a database/schema |
| `postgres_connection_info` | K8s metadata only — no secrets |
| `postgres_query` | SQL via kubectl exec (SELECT/WITH/SHOW/EXPLAIN by default) |

Writes require `MCP_POSTGRES_ALLOW_WRITES=true` in MCP env.

---

## Example tool calls

```json
{ "tool": "postgres_agent_guide", "arguments": {} }
```

```json
{ "tool": "postgres_health_check", "arguments": {} }
```

```json
{ "tool": "postgres_database_catalog", "arguments": { "service": "auth-microservice" } }
```

```json
{ "tool": "postgres_list_tables", "arguments": { "database": "auth" } }
```

```json
{ "tool": "postgres_query", "arguments": { "database": "auth", "sql": "SELECT COUNT(*) FROM users" } }
```

---

## Setup

Copy [mcp.project.json](../cursor/mcp.project.json) to workspace MCP config:

- **Cursor:** `shared/.cursor/mcp.json` (via `.cursor` → `shared/.cursor` symlink)
- **Claude Code:** `~/.claude.json` — same `postgres` server block
- Allowlist name: **`postgres`**

Restart the IDE after changes.

**Smoke test:**

```bash
node shared/mcp/postgres-mcp/server.js --smoke
```

Expected: `"ok": true`, `"catalogSize"` > 0, `"liveDatabases"` > 0.

---

## Environment variables

| Variable | Default |
| --- | --- |
| `ECOSYSTEM_ROOT` | `/home/ssf/Documents/Github` |
| `K8S_NAMESPACE` | `statex-apps` |
| `POSTGRES_SERVICE` | `db-server-postgres` |
| `POSTGRES_USER` | `dbadmin` |
| `MCP_POSTGRES_ENABLE_QUERY` | `true` |
| `MCP_POSTGRES_ALLOW_WRITES` | `false` |

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| MCP server `postgres` not listed | Add config from [mcp.project.json](../cursor/mcp.project.json); restart IDE |
| `kubectl unavailable` | Install/fix kubectl; verify cluster access |
| Deployment not ready | `kubectl rollout status deployment/db-server-postgres -n statex-apps` |
| Unknown database name | `postgres_list_databases` or `postgres_database_catalog` |
| Query disabled | Set `MCP_POSTGRES_ENABLE_QUERY=true` in MCP env |
| Wrong MCP server path | Use absolute path to `shared/mcp/postgres-mcp/server.js` |

**Manual cluster check (humans only, not agent first step):**

```bash
kubectl exec -n statex-apps deployment/db-server-postgres -- pg_isready -U dbadmin
```

---

## Credentials policy

- Stored in Vault (`secret/prod/<service>`) → External Secrets Operator → Kubernetes Secret → pod env
- MCP **never** returns passwords
- Agents must not read secrets from `.env`, Vault CLI, or `kubectl get secret`

---

## Application code (not agents)

Services connect from pods using Kubernetes service DNS (`DB_HOST=db-server-postgres`). Full checklist: [database-server/docs/ARCHITECTURE.md](../../../database-server/docs/ARCHITECTURE.md).
