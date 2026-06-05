# Shop Assistant

AI shopping assistant ("Я хочу"): voice or text input, iterative refinement via feedback, global internet search for best price, redirect to merchant product page.

## Landing Page

The root path `/` serves a marketing landing page that sells the service. Static assets are in `public/` and copied to `dist/public/` during build.

### Legal Compliance (EU AI Act, GDPR, Cookies)

- **Privacy Policy** (`/privacy.html`) — GDPR-compliant data protection
- **Cookie Policy** (`/cookies.html`) — ePrivacy/GDPR cookie disclosure
- **Terms of Service** (`/terms.html`) — includes EU AI Act transparency obligations
- **Cookie consent banner** — Accept/Decline; preference stored in localStorage
- **EU AI Act (Art. 50) transparency notice** — Prominent disclosure that users interact with an AI system

**Company/legal info** is loaded from `.env` at runtime. Set `COMPANY_LEGAL_NAME`, `COMPANY_ICO`, `COMPANY_DIC`, `COMPANY_ADDRESS`, `COMPANY_PHONE`, `LEGAL_EMAIL`, `PRIVACY_EMAIL`, `DPO_EMAIL`, `LEGAL_JURISDICTION` (see `.env.example`). Defaults: Alfares s.r.o., IČ 27138038, DIČ CZ27138038, Cetechovice 70, <ssfskype@gmail.com>, +420 774 287 541.

## Business requirements (initial stage)

The assistant at the initial stage must:

1. **Collect and compare products by user priorities** — Gather product options and compare them according to user-defined priorities (e.g. price, quality, location/delivery). The COMPARISON and LOCATION agents support this; priorities can be set per request or per saved search.
2. **Search simultaneously for multiple products** — Run search for several distinct products in one request (e.g. "red skirt + winter boots + scarf"). The system parses the query into multiple search intents and runs searches in parallel (or batch), then aggregates results per product type.
3. **Search for multiple users in one account** — Support multiple "profiles" or "recipients" per account (e.g. clothes for Mom, Dad, and Child; or three different children). Each search can be scoped to a profile; the user selects "who is this for?" when submitting.
4. **Save search criteria (optional)** — If the user chooses, save the criteria (priorities, product types, profiles, filters) for reuse. Stored criteria can be named and launched again (e.g. "Weekly groceries", "Kids school clothes").

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for implementation ideas and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the task plan.

## Responsibilities

- Create sessions and accept user queries (text or audio URL).
- Use ai-microservice for ASR (speech-to-text) and LLM (query extraction/refinement).
- Call external search API (e.g. Serper) for web search; store and return results.
- Refine search from user feedback; record chosen product and return redirect URL.

## Leave requests (form / voice)

When a user leaves a request via the contact form or voice:

1. **Saved on server** – Every request is stored in the shop-assistant DB (table `LeadRequest`).
2. **Leads microservice** – Data is sent to leads-microservice (`LEADS_SERVICE_URL`) for CRM and confirmations.
3. **AI analysis** – The same data is sent to ai-microservice (`AI_SERVICE_URL`), `POST /api/process-submission`, for analysis (same behaviour as statex submission flow).

## Required integrations

Shop-assistant integrates with the following shared microservices (see repository root README and [docs/INTEGRATION.md](docs/INTEGRATION.md)):

- **ai-microservice** (`AI_SERVICE_URL`) — ASR (speech-to-text), LLM (query extraction/refinement, agent prompts), lead analysis (`/api/process-submission`). Used for COMMUNICATION, SEARCH (orchestration), COMPARISON, LOCATION, PRESENTATION agents. For multi-product search, LLM can split a query into multiple search intents.
- **auth-microservice** (`AUTH_SERVICE_URL`) — JWT validation for admin and (optional) user-bound sessions. Required for admin section; for multi-user-in-account, provides `userId` to associate sessions, profiles, and saved search criteria.
- **database-server** (PostgreSQL via `DB_*` / `DATABASE_URL`) — Sessions, messages, search runs, results, choices, agent prompts, lead requests, agent communications; future: account profiles, saved search criteria.
- **logging-microservice** (`LOGGING_SERVICE_URL`) — Central logging for all operations and errors.

## Other microservices

- **Leads** (`LEADS_SERVICE_URL`) – contact/voice submissions (e.g. `https://leads.${DOMAIN}` or `http://leads-microservice:4400`).
- **Nginx** – blue/green deployment and routing.

## External Search API

Configure one provider (e.g. Serper) via `.env`:

- Search is delegated to ai-microservice (`POST /api/shop-assistant/search`); Serper/API keys are configured in ai-microservice, not here.

## API Summary

- `POST /api/leads/submit` — Submit lead from contact form (proxy to leads-microservice). Body: `message`, `contactMethods`, optional `name`, `voice_file`, `files`.
- `POST /api/sessions` – Create session (body: optional `userId`). Returns `{ sessionId }`.
- `POST /api/sessions/:id/query` – Body: `{ text?, audioUrl? }`. Returns `{ results, queryText }`.
- `POST /api/sessions/:id/feedback` – Body: `{ message, selectedIndices? }`. Returns refined `{ results, queryText }`.
- `GET /api/sessions/:id/results` – Paginated result sets (query: `page`, `limit`).
- `GET /api/sessions/:id/choice/:productId` – Returns `{ productUrl }` for redirect.
- `GET /api/sessions/:id/choice/:productId/redirect` – 302 redirect to product URL.
- `GET /api/sessions/:id/messages` – Get client-assistant messages for debugging.
- `GET /api/sessions/:id/agent-communications` – Get agent-to-agent communication logs for debugging.
- **Admin (JWT required):** `GET/POST /api/admin/prompts`, `GET/PUT/DELETE /api/admin/prompts/:id` – CRUD for AI agent prompts (search, comparison, location, communication, presentation). Each prompt can set **model** (ai-microservice model id) and **role** (e.g. default, premium). `GET /api/admin/ai-models` – list available AI models for the dropdown. All LLM requests use prompts and models from the admin panel. See `docs/API.md`.
- `GET /health` – Health check.
- `GET /test.html` – Test interface with prefilled request. Creates session, submits query, shows results and a single chat with the assistant. Link "View agent flow in Admin" opens the admin panel to inspect internal agent communication for that session.
- `GET /admin.html` – Admin UI (JWT required for Prompts and AI Models): CRUD for agent prompts, list AI models from ai-microservice, **view agent communication flow** by session ID (internal AI workflows; use `?sessionId=…#flow` to open flow tab with session prefilled). Store JWT in the page (Save token) or pass `?token=…` in URL.
- `GET /debug.html` – Internal debug view (client messages + agent-to-agent communication). Not linked from the public UX; use admin panel "Agent communication flow" to test workflows.

## Documentation

- **Development guide:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — architecture, MVP scope, workflows, references.
- **Implementation verification:** [docs/AI_VERIFICATION_PROMPT.md](docs/AI_VERIFICATION_PROMPT.md) — prompt for an AI agent to verify requirements compliance.
- **Fix plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — gaps and tasks to complete the MVP.
- API, deployment, integration: [docs/API.md](docs/API.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/INTEGRATION.md](docs/INTEGRATION.md), [docs/MODEL_AND_ROLE_MANAGEMENT.md](docs/MODEL_AND_ROLE_MANAGEMENT.md).

## Configuration

All configuration via `.env`. See `.env.example` for keys (no secrets in example). Backup `.env` before changes; never commit `.env`.

## Deployment (Blue/Green)

```bash
./scripts/deploy.sh
```

Uses `docker-compose.blue.yml` and `docker-compose.green.yml`; calls `nginx-microservice/scripts/blue-green/deploy-smart.sh shop-assistant`. Ensure `DOMAIN` is set in `.env` (e.g. `shop-assistant.alfares.cz`).

## Database

Create database on shared PostgreSQL before first deploy, e.g.:

```sql
CREATE DATABASE shop_assistant;
```

Container runs `prisma migrate deploy` on startup.

## Ports

- **45xx** range: `PORT=4500` (blue), `PORT_GREEN=4501` (green).
