---
name: feedback_no_silent_failures
description: "Never fail silently — always add extensive logging, raise errors early, alert on failures. Global rule for all code."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 82adf14d-b389-4e06-b2a9-eac027306d31
---

Never fail silently. Always add extensive logging and raise errors immediately when something goes wrong.

**Why:** Silent failures mask bugs and make debugging extremely hard. The user discovered a bug where `if (!res.ok) return` swallowed a fetch error, causing an empty UI with no indication of what went wrong.

**How to apply:**
- Never write `catch (e) { /* ignore */ }` or `if (!res.ok) return` without logging
- Every catch block must log the error: `console.error('[ComponentName] operation failed:', e)`
- Every non-ok HTTP response must log: status, URL, response body
- In NestJS services: throw exceptions or log at `error` level — never swallow
- In frontend JS: `console.error(...)` with context (function name, URL, params) before any early return
- Use `console.warn` for degraded-but-recoverable states, `console.error` for failures
- Add timing logs for slow operations (>1s): `console.warn('[fn] slow: Xms')`
- In try/catch: always re-throw or log — never both swallow AND continue as if nothing happened
- Alert the user in UI when a fetch fails — don't leave dropdowns empty with no message
