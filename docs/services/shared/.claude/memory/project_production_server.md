---
name: production server migration to alfares
description: All production services have moved from statex to alfares server
type: project
---

All microservices and applications in the Statex ecosystem are now deployed on **alfares**, not statex.

**Why:** User confirmed "everything is deployed on the server alfares" on 2026-04-05.

**How to apply:**
- Use `ssh alfares` to connect to production
- Production paths are `/home/ssf/Documents/Github/<service-name>/`
- CLAUDE.md has been updated to reflect this
- `statex` server is legacy — do not use for new deployments
- `sgipreal` server is unaffected (separate server for SGI Real Estate)
