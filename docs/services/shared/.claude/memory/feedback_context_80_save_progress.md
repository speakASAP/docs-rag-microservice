---
name: Save Progress at 80% Context
description: At ~80% context fill, save current task status to documentation so next session starts informed without spending tokens re-deriving state
type: feedback
originSessionId: f301a4b5-1529-451b-be07-e43ed935e791
---

When context is approximately 80% full, proactively save current session state to documentation before the session ends or context compresses.

**Why:** Starting a new session cold wastes tokens re-deriving project progress. Saving state mid-session ensures the next session can resume efficiently from documented state.

**How to apply:**

- Monitor context usage — when approaching ~80%, pause and write a progress snapshot
- Write to the relevant project's STATE.json or TASKS.md (per PROJECT_AGENT_DOCS_STANDARD.md)
- Include: completed tasks (with outcomes), in-progress tasks (current state), next tasks (with enough context to resume), any blockers or decisions made
- Also update MEMORY.md index entries for any project memories that changed
- This applies to any multi-step work: implementation plans, debugging sessions, migrations, deployments
