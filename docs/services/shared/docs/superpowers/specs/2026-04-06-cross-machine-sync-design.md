# Separate Development Environments

**Date:** 2026-04-06  
**Updated:** 2026-04-11 — Sync abandoned. Environments are now fully independent.

---

## Decision

Cross-machine synchronization between **MacBook** and the alfares server has been **permanently discontinued**.

Each machine is an independent development environment. There is no automated sync, no shared Cursor/Claude user settings, no cron jobs pulling from the other machine.

---

## Environments

| Machine | Path | Purpose |
|---------|------|---------|
| **alfares** (this server) | `/home/ssf/Documents/Github/` | Production server — primary development environment |
| **MacBook** (local) | `/Users/sergiystashok/Documents/GitHub/` | Local machine — independent, separate |

Both machines have their own:

- `~/.claude/settings.json` — local copies, not symlinked
- `~/.claude/hooks/`, `agents/`, `skills/` — local copies
- `~/.cursor/` — independent Cursor settings
- Crontab — no sync jobs on either machine

---

## Why Sync Was Abandoned

Bidirectional sync caused more problems than it solved:

- Symlinks broke when paths differed between MacBook (`/Users/sergiystashok/...`) and server (`/home/ssf/...`)
- Hourly `git pull` on the server auto-merged remote changes into live code, causing unexpected state
- Claude Code hooks pointed to missing files after sync overwrote paths, blocking all Bash tool calls
- The complexity of maintaining sync was not worth the benefit

---

## How to Keep Environments in Sync (manually, when needed)

If a settings change needs to be replicated from one machine to the other:

1. Make the change on one machine
2. Commit it to the relevant repo on GitHub
3. Manually `git pull` on the other machine when convenient

No automated mechanism. User decides when to sync.

---

## Cron Jobs

**alfares:** none  
**MacBook:** none (remove `sync-dev-environment.sh` from crontab if still present)

---

## Claude Code Config (alfares)

All `~/.claude/` entries are real files/directories — no symlinks:

- `~/.claude/settings.json` — real file
- `~/.claude/hooks/` — real directory with 5 hook scripts
- `~/.claude/agents/` — real directory
- `~/.claude/skills/` — real directory

Changes to shared repo (e.g. `shared/.claude/settings.json`) do **not** automatically apply to `~/.claude/`. Update manually if needed.
