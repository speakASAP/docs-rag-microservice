---
name: env-edit
description: Human-in-the-middle approval flow for editing .env files containing production secrets. Use this skill whenever you need to edit any .env file (not .env.example). Every edit requires explicit user approval — no exceptions.
user-invocable: false
---

# .env Edit Approval Flow

`.env` files are protected by a hook that requires explicit user approval for every edit.
This is a deliberate safety gate — production secrets must never be changed without human sign-off.

## When to invoke this flow

Any time you need to edit a file matching:

- `.env`
- `.env.*` (e.g. `.env.local`, `.env.production`) — **except** `.env.example`, `.env.test`, `.env.sample`

## The process — follow exactly, every time

### Step 1: Show the proposed change to the user

Before attempting the edit, tell the user:

> "I need to edit `<full path to .env file>` which contains production secrets.
> Here is the exact change I want to make:
>
> ```
> [show the specific lines to add/change/remove]
> ```
>
> Do you approve this change? (yes/no)"

### Step 2: Wait for explicit approval

Do NOT proceed until the user says yes, approve, ok, or equivalent.
If the user says no — stop. Do not edit the file.

### Step 3: Create the approval token

```bash
touch /tmp/.claude-env-edit-approved
```

The token is single-use and expires in 60 seconds. Create it immediately before the edit.

### Step 4: Make the edit

Proceed with the Edit/Write/MultiEdit tool. The hook will find the token, allow the edit, and delete the token.

### Step 5: Confirm

Tell the user the edit was made and show a summary of what changed.

## Rules

- Each edit = one approval cycle. Multiple edits to the same file = multiple approvals.
- Never batch `.env` edits across multiple files under a single approval.
- Never create the token preemptively — only after explicit user approval.
- If the token expires before you retry (>60s), create a new one after re-confirming.
- `.env.example` files do NOT need this flow — edit them freely.
