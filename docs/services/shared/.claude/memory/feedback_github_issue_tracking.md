---
name: github-issue-tracking
description: "Always create GitHub issues for every task, update with decisions, close when done. Cross-link related issues."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b916bc85-4eff-4ba1-9643-c1e972825d09
---

At the start of EVERY task, before writing any code:

1. Identify affected repo(s)
2. Create GitHub issue with title + short description via `gh issue create`
3. Apply labels: `task` + `in-progress` + `bug`/`feature` as appropriate
4. Search existing issues in affected repo(s) for related work — add links under "Related" section
5. For cross-repo tasks: master issue in `speakASAP/shared` (label: `cross-repo`), child issues in each repo, all linked bidirectionally
6. During implementation: post minimal decision comments — format: `Decision: <what> — <why>`
7. On completion: remove `in-progress` label, close issue referencing commit/PR

**Cross-linking rules:**
- Same-repo: use `#<n>` shorthand
- Cross-repo: use full URL `https://github.com/speakASAP/<repo>/issues/<n>`
- Always link related/similar past issues so decision history is traceable

**Wiki rule:**
- Public repos: new documentation goes to GitHub Wiki, not codebase
- Private repos: docs stay in codebase

**Why:** User wants full task history outside the codebase, decision traceability, and cross-repo task relationships visible in GitHub.

**How to apply:** Every single task, no exceptions. This is not optional.
