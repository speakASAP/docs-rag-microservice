---
name: project_token_economy
description: "Token spend is 98.7% cache_read of accumulated context; session length is the dominant lever, not config"
metadata:
 node_type: memory
 type: project
 originSessionId: 3f0bfbf2-2c48-439d-a63e-bf6d9df6222b
 modified: 2026-08-01T03:35:11.202Z
---

Measured 2026-07-31 across 69 sessions: **3.31B tokens total, 98.7% `cache_read`.** Worst session: 438M over 1,175 turns, average context **372k/turn**, peak **729k** (1M-context model lets it balloon). Raw tool output in that session was only ~99k tokens — the context is accumulated assistant reasoning + history, not tool results.

Startup payload measured at turn 0: **31k tokens**.

**Why:** every turn re-bills the whole conversation. A 400k context costs ~13x a 30k one, ~1000+ times per session. Keeping context under ~100k would have made that session ~100M instead of 438M (~4x).

**How to apply:** session hygiene beats every config tweak by ~10x. Write status to `STATE.json`/`TASKS.md` and `/clear` at ~80% context or ~150 turns. Config already applied (committed `shared` 5654fc6): `alwaysThinkingEnabled: false`, `effortLevel: medium`, CLAUDE.md 14.5K→8.4K with forensics in `shared/docs/AGENT_INCIDENT_LOG.md`, unused plugins off, duplicate playwright + github + stripe MCP dropped from `.mcp.json`.

Note: `~/.claude/skills` is a symlink to `shared/.claude/skills`, which sits inside the project root — so those skills get advertised **twice** (unscoped + `shared:`-scoped), ~1.5k tokens/session. Unfixed: removing the symlink would lose the skills in other repos. See [[feedback_context_80_save_progress]].

Caveman mode (`/caveman`) cuts assistant output ~75%; that compounds, since output accumulates in context — but it is a second-order lever behind `/clear` discipline.
