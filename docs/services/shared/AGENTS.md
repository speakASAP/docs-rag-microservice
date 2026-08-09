# Agents: shared

## Knowledge Retrieval (query before reading files)

The RAG service indexes all 35 ecosystem repos. Query it first to save 2000-5000 tokens per question:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`


## Database Access Policy

**Mandatory agent entry point:** [docs/mcp/MCP_POSTGRES.md](docs/mcp/MCP_POSTGRES.md)

MCP server `postgres` → `postgres_agent_guide` (first) → `postgres_health_check` → discover DB → `postgres_query`.

Infrastructure SSOT (app config, not agent queries): [database-server/docs/ARCHITECTURE.md](../database-server/docs/ARCHITECTURE.md)

Do not use host psql, localhost, port-forward, `.env` passwords, or generic postgres MCP servers.

## Token Compression

Caveman is active at `lite` intensity by default across all sessions and subagents.
- `lite` — removes filler words only; code, paths, JSON, file content stay byte-perfect
- Override per-session: `/caveman full` (telegraphic) or `/caveman ultra` (maximum brevity)
- Do not set higher than `lite` for human-facing output (notifications, emails, UI text)

## Scope

Work in **`shared/`** only unless the task explicitly spans sibling repos.

## Priorities

1. Keep [README.md](README.md) and [ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md) consistent when services/ports change.
2. Add or update **standards** under `docs/` (short, linkable); avoid duplicating per-repo `SYSTEM.md` content.
3. Env tooling: secrets live in Vault (`secret/prod/<service>`); never put secret values in examples.

## Rules

- **Never commit or push** — user reviews all git changes.
- **Do not edit** root `BUSINESS.md` unless the human owner asks; propose via `TASKS.md` or a suggestions file.
- Trailing whitespace is not allowed in edited files.

## Cursor

- Workspace rules: `../.cursor/rules/` (from repo root: `.cursor/rules/` when workspace is GitHub parent).
- Setup reference: [docs/cursor/CURSOR_SETUP.md](docs/cursor/CURSOR_SETUP.md)
