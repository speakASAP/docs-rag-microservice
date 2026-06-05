# Shop Assistant Integration

Shop-assistant **must** integrate with these shared microservices (see repository root README): **ai-microservice**, **auth-microservice**, **database-server**, **logging-microservice**. They are required for core flows and for initial-stage business requirements (priorities, multi-product search, multi-user per account, saved search criteria).

## Auth (optional for sessions; required for admin and saved features)

- Set `AUTH_SERVICE_URL` (e.g. `https://auth.alfares.cz`).
- For protected routes, validate JWT via auth-microservice (e.g. `GET /validate` or decode with shared `JWT_SECRET`). Current implementation does not enforce auth; sessions can be anonymous or store `userId` from token.
- For **multi-user per account** and **saved search criteria**, auth-microservice provides `userId`; shop-assistant stores profiles and saved criteria per userId. Do not modify auth-microservice; use its APIs only.

## Database (database-server)

- Shared PostgreSQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- `DATABASE_URL` must be set for Prisma (e.g. `postgresql://USER:PASSWORD@HOST:PORT/DB_NAME`).
- Database name suggested: `shop_assistant`.
- Do not modify database-server; use it as the shared data store. Future models (e.g. AccountProfile, SavedSearchCriteria) live in shop-assistant DB on the same database-server.

## Logging (logging-microservice)

- All operational logs sent to `LOGGING_SERVICE_URL` (e.g. `https://logging.alfares.cz`) at `LOGGING_SERVICE_API_PATH` (default `/api/logs`).
- Payload: `{ service, level, message, meta, timestamp }`.
- Do not modify logging-microservice; use it for all important operations and errors (including new flows for priorities, multi-product, multi-user, saved criteria).

## AI (ai-microservice, required)

- **ASR**: POST to `AI_SERVICE_URL` with path `/api/shop-assistant/transcribe`, body `{ "voice_file_url": "..." }`. Returns `{ "transcript": "..." }`.
- **LLM**: POST to `AI_SERVICE_URL` with path `/api/analyze-text`, body `{ "text_content": "...", "analysis_type": "content_generation" }`. Response summary used as refined search query.
- For **multi-product search**, LLM can be used to split user text into multiple search intents. For **priorities**, COMPARISON and LOCATION agent prompts (via admin) drive ranking and delivery-region filtering. Do not modify ai-microservice; use its APIs only.

## External search

- Search is delegated to **ai-microservice** (`POST /api/shop-assistant/search`). Serper or other provider URL/API keys are configured in ai-microservice, not in shop-assistant. Shop-assistant only needs `AI_SERVICE_URL`.

## Leads (leads-microservice)

- Set `LEADS_SERVICE_URL` (e.g. `https://leads.alfares.cz` or `http://leads-microservice:4400` in Docker).
- Contact form submissions from the landing page are proxied to leads-microservice at `POST /api/leads/submit`.
- Payload: `sourceService`, `sourceUrl`, `sourceLabel`, `message`, `contactMethods` (array of `{type, value}`), `metadata`.
- Leads-microservice handles confirmation messages via notifications-microservice.

## Nginx

- Routes from `nginx-api-routes.conf` are registered by deploy-smart.sh. Do not create service-registry files manually; they are generated during deployment.
