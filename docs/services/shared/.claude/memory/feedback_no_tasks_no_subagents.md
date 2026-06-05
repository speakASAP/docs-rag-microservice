---
name: No Tasks, No Subagents — Token Savings Mode
description: Never use TaskCreate/TaskUpdate tools or spawn subagents; work directly inline to save tokens; use cheapest model for simple tasks
type: feedback
originSessionId: 7a5b5fe1-39c5-44a0-a8e1-7b95032118a9
---
Never use the TaskCreate/TaskUpdate task tracking tools — they waste tokens. Do all work directly inline.

Never spawn subagents (Agent tool) unless absolutely required by a skill that mandates it — they cost significant tokens.

For simple, mechanical tasks (single-file edits, lookups, config changes), use the cheapest/fastest model available rather than a more capable one.

**Why:** User explicitly requested token savings; task overhead adds unnecessary context; subagents duplicate context.

**How to apply:** Work directly in the main session. Skip all task creation. Only spawn subagents if a mandatory skill explicitly requires it AND the task complexity genuinely warrants it.
