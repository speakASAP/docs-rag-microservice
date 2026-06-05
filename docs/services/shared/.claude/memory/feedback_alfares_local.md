---
name: Already on alfares server
description: The working directory /home/ssf/Documents/Github IS alfares — do not SSH to localhost
type: feedback
originSessionId: f42e4c95-56b8-4e40-be77-d04e1605a398
---
Never SSH to `alfares` — this terminal IS the alfares server. Run docker, curl, and production commands directly without SSH.

**Why:** User corrected this explicitly — SSHing to yourself fails and wastes time.

**How to apply:** When CLAUDE.md or memory says "SSH to alfares", instead run commands directly in the local shell.
