---
name: No Git Commit or Push — Ask User Instead
description: AI must NEVER run git commit or git push. If a commit or push is needed, ask the user in chat to do it manually.
type: feedback
---

**Rule: NEVER run `git commit` or `git push`.**

**Why:** The user reviews ALL changes made by ALL agents before committing. This is a hard control gate — the user needs visibility and approval over every commit across the entire multi-server, multi-agent workflow.

**How to apply:**

- You MAY: make code changes, run `git status`, run `git diff`.
- You MUST NOT: `git commit`, `git push`, or any script that does either
- When a commit/push is needed: tell the user in chat what to commit and why, then stop and wait
- This applies to ALL repos, ALL branches, ALL contexts — no exceptions
