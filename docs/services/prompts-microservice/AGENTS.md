# AGENTS.md

## Purpose

Agent guidance for `prompts-microservice`.

## Boundaries

- Do not edit nginx-microservice directly.
- Keep `.env` as single source of truth.
- Keep `.env.example` synchronized with `.env` keys only.
- Never commit secrets.

## Common commands

```bash
npm install
npm start
npm run check
docker compose -f docker-compose.blue.yml config --quiet
docker compose -f docker-compose.green.yml config --quiet
./scripts/deploy.sh
```

## Logging

- Include ISO timestamp in events.
- Include `duration_ms` for request/operation logs.
- Prefer diagnosing delays from logs over timeout increases.
