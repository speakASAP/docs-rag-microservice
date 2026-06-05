# Cursor IDE setup — Statex workspace

Goals: **minimal context**, **no secrets** in prompts or generated edits.

## Workspace

- Open the **parent folder** that contains all sibling repos (e.g. `Documents/GitHub`) as a multi-root or single root workspace so paths like `../auth-microservice` match [shared/README.md](../../README.md).
- **Verify shared Cursor config**: at that parent, `ls -la .cursor` should show `.cursor` → `shared/.cursor` (symlink). Hooks and rules load from there.
- **VS Code / Cursor workspace settings**: merge keys from [workspace-settings.fragment.json](workspace-settings.fragment.json) into the root `.vscode/settings.json` (reduces watcher/search load on `node_modules`, `dist`, etc.). If `.vscode` is not writable on a given host, apply the same keys in user settings.

### Hooks must be on

In **Cursor Settings → Hooks**, enable hooks so `.cursor/hooks.json` runs (secret blocking on prompt, shell, MCP; warning after file edits).

## MacBook and server (independent)

**MacBook and the server are separate.** There is no automated sync of Cursor or Claude user settings between machines (`~/.cursor/`, `~/.claude/`). Configure each machine independently. Shared **repo** config (e.g. `shared/.cursor/` via git) still applies after you pull on that machine.

Rationale and manual alignment when you want it: [2026-04-06-cross-machine-sync-design.md](../superpowers/specs/2026-04-06-cross-machine-sync-design.md).

## Project rules (this repo)

Located under `.cursor/rules/` at the workspace root:

| Rule | Scope |
|------|--------|
| `no-git-commit.mdc` | Global — agents never commit/push. |
| `short-responses.mdc` | Global — concise replies. |
| `frontend.mdc` | TSX/JSX/Vue/components — UI and public env hygiene. |
| `backend.mdc` | NestJS (modules/controllers/services/guards/interceptors), Prisma schema, compose — logging, `.env`, nginx note. |

## Hooks (secrets)

- Config: `.cursor/hooks.json`.
- Scripts: `.cursor/hooks/*.mjs` — block **prompts**, **shell**, and **MCP** that match common secret shapes; **warn** after file edits (hook cannot revert; check notification and fix).
- Enable hooks in **Cursor Settings → Hooks** (required; see above).

## Commands

- `.cursor/commands/logsanalyze.md` — speakasap log workflow.
- `.cursor/commands/council.md` — four-role structured review in one pass.

## MCP (required for database access)

**PostgreSQL:** enable MCP server `postgres` — mandatory for all agents.
Agent entry point: [docs/mcp/MCP_POSTGRES.md](../mcp/MCP_POSTGRES.md) — first tool: `postgres_agent_guide`.

**Project template:** copy [mcp.project.json](mcp.project.json) to `shared/.cursor/mcp.json` at repo root that is the symlink target (i.e. the file path `shared/.cursor/mcp.json` in git). With workspace symlink `ln -s shared/.cursor .cursor`, Cursor picks up `.cursor/mcp.json`. Restart Cursor after changes.

| Server | When to use |
|--------|-------------|
| **postgres** | **All PostgreSQL discovery and queries.** Call `postgres_agent_guide` first. |
| **Context7** | Fetch current library/framework docs. Optional: `npx ctx7 setup --cursor` for OAuth. |
| **Playwright** | Browser/E2E verification. |
| **Supabase** | Only for repos that actually use Supabase; default stack uses **database-server** Postgres via MCP `postgres`. |

Document per-project exceptions in that repo’s `SYSTEM.md`.

## Recommended marketplace skills

Install only what you use; large skill sets conflict.

| Skill / area | Use |
|--------------|-----|
| **verification-before-completion** | Run checks before claiming done. |
| **systematic-debugging** | Ordered debugging before random fixes. |
| **writing-plans** / **executing-plans** | Spec-first, multi-step work. |
| **requesting-code-review** / **receiving-code-review** | PR-style quality loops. |
| **supabase-postgres-best-practices** | SQL/schema review. |
| **using-git-worktrees** | Isolated branches (optional). |
| **frontend-design** | New UI that must not look generic (use sparingly). |

Install via Cursor **Skills / Marketplace**; global skills often live under `~/.cursor/skills-cursor/` (see Cursor docs for current paths).

**One-time install (UI):** Cursor → **Settings** → **Rules / Skills** (or **Skills** / **Marketplace**, per your Cursor version) → install only the rows from the table above that you use. Avoid bulk-installing unrelated skills (context bloat and conflicting guidance).

## Settings hints

- Trim trailing whitespace on save; exclude `node_modules`, `dist`, large artifacts from indexing if Cursor slows down.
- Prefer **globs** on rules instead of `alwaysApply: true` for stack-specific guidance to save context.

## Doc standard for repos

See [PROJECT_AGENT_DOCS_STANDARD.md](../PROJECT_AGENT_DOCS_STANDARD.md).
