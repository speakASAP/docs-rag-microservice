---
name: Cursor IDE Delegation Workflow
description: ALL simple tasks must be delegated to Cursor via prompt files — never implement simple work directly in Claude Code
type: feedback
---

**Rule: ALL simple tasks MUST be delegated to Cursor. Never implement them directly.**

**Why:** User has a Cursor subscription and wants to save Claude Code tokens. Simple file creation / spec implementation is better delegated to Cursor. This is a hard rule, not a suggestion.

**How to apply:**

Before doing any implementation, classify the task:

| Task type | Who | Action |
|-----------|-----|--------|
| **Simple** — create files from spec, boilerplate, modules, CRUD, config, nginx, docker-compose, deploy.sh | **Cursor** | Write prompt file, do NOT implement |
| **Complex** — architecture, debugging, cross-service reasoning, multi-file design, ADRs, plans | **Claude Code** | Implement directly |

**Cursor task file location:** `<service>/docs/superpowers/cursor-tasks/task-NN-<name>.md`

**Format:** Include exact file paths + complete code + `## Verify` section. User copies into Cursor, runs it, reports back.

**After Cursor completes:** Acknowledge and proceed to next step (review, next task, deployment) without re-doing the Cursor work.

**Nginx / deploy.sh is always a Cursor task** — follow `shared/docs/DEPLOY_STANDARD.md`, `DEPLOY_SCRIPT_RULES.md`, `NGINX_LOCAL_CONFIG.md` in the prompt.
