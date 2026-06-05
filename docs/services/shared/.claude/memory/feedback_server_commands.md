---
name: Server command authorization
description: User authorizes running server/production commands (curl, docker, etc.) without asking permission first
type: feedback
originSessionId: 60b44ae9-28f0-4b4e-b296-e0b14094fd1e
---
Run production server commands directly without asking for confirmation — including curl API calls, docker start/restart, health checks, and runbook steps on localhost.

**Why:** User confirmed "you are on alfares server already" and explicitly authorized this for all future sessions.

**How to apply:** Execute runbook steps, API calls, and docker operations directly. Do not pause to ask "shall I run this?" for standard operational commands on localhost.
