 `logs/` at workspace root (not a git app)

The sibling folder `logs/` next to other repos often holds **host paths** for nginx/certbot-related data. It is typically owned by a dedicated user (e.g. `nobody`) and **must not** be `chown`’d by automation.

## For agents

- Do not expect `BUSINESS.md` / `SYSTEM.md` / … inside `logs/` — the directory may not be writable from the dev account.
- Treat it as **ops layout**, not a Statex microservice. Do not add application code there.

## Optional human action

If you truly need agent stubs under `logs/`, fix ownership and permissions **manually** as the server admin — never from agent shell scripts.
