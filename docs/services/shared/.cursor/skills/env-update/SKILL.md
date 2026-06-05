---
name: env-update
description: >-
  Treats user invocation as approval to apply a specific, already-proposed change
  to a secrets .env file. Use when the user runs /env-update, says "env-update", or
  authorizes adding proposed values to .env after the agent showed exact lines.
---

# env-update (.env apply authorization)

## When this skill applies

The user explicitly triggers **`/env-update`** or clearly refers to **env-update** / **authorize env** in the same thread where the agent has **already shown the exact lines** to add or change in a `.env` (or `.env.*` secrets file, excluding `.env.example` / `.env.test` / `.env.sample`).

## What the user is authorizing

- **One cycle**: apply **only** the change that was **proposed immediately before** this authorization (same turn or the agent’s last message with a concrete diff/lines).
- Scope is **proposed values** the agent listed (add or update those keys/lines). It is **not** blanket permission to edit unrelated secrets or to run `cat .env` and copy arbitrary output without a prior proposal.

## Agent workflow (must follow)

1. **Confirm match**: The pending proposal must be unambiguous (one target file, one set of lines). If several `.env` edits were discussed, ask which file or re-propose before applying.
2. **Backup** (workspace rule): Before editing a production `.env`, create a backup of the existing file (e.g. timestamped copy next to it). Do not print secret values in chat.
3. **Hook token**: Immediately before the edit, run:

   ```bash
   touch /tmp/.claude-env-edit-approved
   ```

   Then apply the edit within the token window (single-use; if it expires, get a fresh `/env-update` and token).
4. **Edit**: Write only the approved lines/keys; keep trailing spaces out.
5. **After**: Summarize **keys** touched (not values). Sync `.env.example` with **key names only** if workspace rules require it.

## What this does *not* do

- Replace **env-edit** safety: still use the approval token for each hook-guarded edit.
- Authorize edits **without** a prior visible proposal of exact changes.
- Allow committing or pushing `.env` (user handles git).

## Interaction with env-edit

If the full **env-edit** skill is also in context, **`/env-update` = user’s “yes”** to the proposal shown in Step 1 of that flow. Still create the token (Step 3) then edit (Step 4).
