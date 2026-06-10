---
name: cursor-task
description: Generate a Cursor IDE task prompt file for delegating simple implementation work to Cursor. Per CLAUDE.md, simple tasks (boilerplate, CRUD, configs, file creation from spec) go to Cursor; complex tasks stay with Claude Code. Usage: /cursor-task <service> <description>
---

The user wants to delegate an implementation task to Cursor IDE.

## CLAUDE.md delegation rule

| Task type | Who does it |
|-----------|-------------|
| Simple — create files from spec, boilerplate, DTOs, CRUD, configs, nginx, deploy scripts | **Cursor** |
| Complex — architecture, debugging, cross-service reasoning, multi-step orchestration | **Claude Code** |

## Step 1 — Detect platform

```bash
IS_MAC=$([ "$(uname -s)" = "Darwin" ] && echo "true" || echo "false")
GITHUB_DIR=$([ "$IS_MAC" = "true" ] && echo "/Users/sergiystashok/Documents/GitHub" || echo "/home/ssf/Documents/Github")
```

## Step 2 — Identify service and task

From the user's argument or context:

- **Service name** (e.g. "runlayer")
- **Task description** (what needs to be created)

## Step 3 — Find next task number

```bash
ls $GITHUB_DIR/<service>/docs/superpowers/cursor-tasks/ 2>/dev/null \
  | grep -oP '(?<=task-)\d+' | sort -n | tail -1
```

Next task number = last + 1 (or `01` if directory is empty).

## Step 4 — Create the task file

Path: `$GITHUB_DIR/<service>/docs/superpowers/cursor-tasks/task-NN-<slug>.md`

The file MUST contain all three sections:

### ## Context

What the service does, what's already built, relevant existing file paths.
Reference real files — Cursor needs full context to avoid guessing.

### ## What to create

List every file to create with its **full path** and **complete contents**.
Cursor follows the spec literally — do not leave anything underspecified.

Include imports, types, decorators, and any boilerplate.

### ## Verify

Shell commands the user can run to confirm the task succeeded:

- `ls src/...` to confirm files exist
- `npx tsc --noEmit` for TypeScript
- `curl http://localhost:<port>/health` for runtime checks

## Step 5 — Tell the user

After creating the file, say:
> "Task file created at `<path>`. Copy the contents into Cursor's **Agents** tab and run it. Report back when done."

Follow the style of existing cursor task files in the repo.
