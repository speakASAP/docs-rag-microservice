# PLAN.md

## v1 plan

1. Scaffold Node.js service with static frontend and REST API.
2. Integrate auth endpoints (`login`, `register`, `validate`) with auth-microservice.
3. Implement PostgreSQL schema and prompt CRUD repository.
4. Build single-page UI for auth + prompt management + category filter.
5. Add docker, blue/green compose files, nginx route list, and deploy script.
6. Validate build, compose config, and health endpoint.

## Acceptance

- `prompts.alfares.cz` serves the UI.
- Authenticated CRUD works end to end.
- Prompt categories are selectable and filterable.
- Service deploys with `scripts/deploy.sh`.
