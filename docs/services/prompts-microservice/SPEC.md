# SPEC.md

## Functional requirements

1. User can register and log in from the web interface.
2. Authenticated user can create, view, update, and delete prompts.
3. Each prompt has:
   - `title`
   - `content`
   - `category` (`skill`, `prompt`, `rule`, or custom)
   - optional `tags`
4. User can filter prompts by category and search by text.
5. Data persists in PostgreSQL and is scoped by user account.

## Non-functional requirements

- Runs as one microservice with one web page.
- Exposes `/api/health` for deployment checks.
- Logs requests and operation durations (`duration_ms`) to centralized logging.
- Supports standard Statex blue/green deployment flow.

## Out of scope

- Collaborative editing on one prompt
- Version history
- Attachments/files
