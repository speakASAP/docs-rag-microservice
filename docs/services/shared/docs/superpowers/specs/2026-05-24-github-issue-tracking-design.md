# GitHub-Native Task Tracking System

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Every task assigned to Claude automatically becomes a GitHub issue in the relevant repo. Issues track the full history of decisions, cross-repo relationships, and implementation outcomes.

## Issue Lifecycle

1. **Task received** → Create issue immediately (before any code) with title + short description
2. **Label** → Apply `task` + `in-progress` + type label (`bug` / `feature`)
3. **Cross-link** → Link to related/similar past issues in same repo and across repos
4. **During implementation** → Post minimal decision comments: one-liner (decision + reason)
5. **Done** → Remove `in-progress`, close issue with reference to commit/PR

## Cross-Repo Tasks

- Master issue created in `speakASAP/shared`
- Child issues created in each affected repo
- All linked bidirectionally in issue body and comments
- Both master and children get `cross-repo` label

## Cross-Linking Rules

- When starting a task, search existing issues in affected repo(s) for related work
- Link related issues in the issue body under a "Related" section
- Cross-repo links use full GitHub URL: `https://github.com/speakASAP/<repo>/issues/<n>`
- Same-repo links use `#<n>` shorthand

## Standard Label Set

| Label | Color | Meaning |
|---|---|---|
| `task` | `#0075ca` blue | General task from user |
| `bug` | `#d73a4a` red | Something broken |
| `feature` | `#0e8a16` green | New functionality |
| `in-progress` | `#e4e669` yellow | Currently being worked on |
| `decision` | `#5319e7` purple | Key architectural/design choice logged |
| `cross-repo` | `#e99695` orange | Master issue spanning multiple repos |

Labels applied consistently across all repos in `speakASAP` org.

## Documentation (Wiki)

- Public repos: new docs go to the repo's GitHub Wiki (e.g., `github.com/speakASAP/<repo>/wiki`)
- Private repos: docs stay in codebase unchanged
- No migration of existing docs — new docs only, going forward

## Repos in Scope

All repos under `speakASAP` org. Cross-repo master issues always land in `speakASAP/shared`.

## Decision Comments Format

```
Decision: <what was chosen> — <one-line reason>
```

Example:
```
Decision: JWT over sessions — stateless, scales across microservices without shared session store
```
