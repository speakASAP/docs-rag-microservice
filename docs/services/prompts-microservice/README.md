# prompts-microservice

Single-page authenticated prompt library at `prompts.alfares.cz` for storing and sharing reusable prompts across machines.

## Features

- Login/register via `auth-microservice`
- Prompt CRUD with owner isolation
- Prompt categories (`skill`, `prompt`, `rule`, plus custom)
- Search and category filtering
- Health endpoint: `GET /api/health`
- Structured operational logging to `logging-microservice`

## API

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/prompts`
- `GET /api/prompts/:id`
- `POST /api/prompts`
- `PUT /api/prompts/:id`
- `DELETE /api/prompts/:id`

## Environment

Copy `.env.example` to `.env` and fill values.

Required integrations:
- `AUTH_SERVICE_URL`
- `LOGGING_SERVICE_URL`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## Local run

```bash
npm install
npm start
```

App: `http://localhost:4750`  
Health: `http://localhost:4750/api/health`

## Docker

```bash
docker compose -f docker-compose.blue.yml config --quiet
docker compose -f docker-compose.green.yml config --quiet
docker compose up --build
```

## Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Deployment uses `nginx-microservice/scripts/blue-green/deploy-smart.sh`.
