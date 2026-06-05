---
name: feedback-database-access
description: Use MCP postgres server for all database access
metadata:
  node_type: memory
  type: feedback
  originSessionId: 07a0189f-bc93-4644-aaae-d84ff763131f
---

All PostgreSQL access goes through MCP server `postgres`.

**How to apply:**
1. Call `postgres_agent_guide` first (mandatory).
2. Follow [shared/docs/mcp/MCP_POSTGRES.md](../../docs/mcp/MCP_POSTGRES.md).

Do not use host psql, localhost, port-forward, or `.env` passwords.
