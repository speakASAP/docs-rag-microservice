# Shop Assistant — Development Documentation

This document is the main development guide for the **shop-assistant** project. Read it together with the project [README.md](../README.md) and the repository root **README.md** and **CREATE_SERVICE.md** (in the same repo as shop-assistant).

---

## 1. Project purpose

**Shop Assistant** ("Я хочу") is an AI shopping assistant that:

- Accepts user requests by **text** (MVP) or **voice** (later).
- Uses **AI agents** (Communication, Search, Comparison, Location, Presentation) to refine the request, search the web, compare options, and present results.
- Shows **progress and intermediary results** (e.g. product photos for discussion) and finally **total price + redirect** to the merchant.

**Example scenario:**  
"Find a red silk skirt size 52, 48 cm long. Find a shop which delivers in the Czech Republic. Find the best quality skirt with the cheapest price and delivery."  
→ User sees progress, can refine in chat, then chooses a result and is redirected to the product URL.

### 1.1 Business requirements (initial stage)

At the initial stage the assistant must support:

| Requirement | Description |
|-------------|-------------|
| **Priorities** | Collect and compare products according to user priorities: **price**, **quality**, **location/delivery**, etc. User can set which matters most; COMPARISON and LOCATION agents apply these when ranking and filtering. |
| **Multi-product search** | Search **simultaneously for several products** in one request (e.g. "red skirt + winter boots + scarf"). The system parses the query into multiple intents, runs searches in parallel (or batch), and returns aggregated results per product type. |
| **Multi-user in one account** | Support **multiple profiles/recipients per account** (e.g. clothes for Mom, Dad, and Child; or three different children). User selects "who is this for?" when submitting; searches and saved criteria can be scoped per profile. |
| **Saved search criteria** | **Save criteria** (priorities, product types, profiles, filters) for reuse when the user chooses. Stored as named templates (e.g. "Weekly groceries", "Kids school clothes") with CRUD and "Run this search" from the UI. |

**Implementation ideas (high level):**

- **Priorities:** Store priority weights or order (e.g. `{ price: 1, quality: 2, location: 3 }`) in session or query params; wire COMPARISON agent to rank/filter by these; LOCATION agent for delivery region. Reuse existing agent prompts and session flow.
- **Multi-product search:** Use ai-microservice LLM to split user text into N search intents; run N searches (parallel or sequential with small batch size); group results by intent in response; extend session/search-run model if needed (e.g. multiple query texts per run or multiple runs per request).
- **Multi-user per account:** Rely on auth-microservice for `userId`. In shop-assistant DB add **account profiles** (e.g. `AccountProfile`: userId, name, role like "mom" / "dad" / "child"). Session or query carries optional `profileId`; UI offers profile selector. No changes inside auth-microservice.
- **Saved search criteria:** New model e.g. `SavedSearchCriteria` (userId, name, priorities JSON, productTypes/intents JSON, profileId optional, filters JSON). CRUD API; "Run saved search" creates session and applies criteria. Use database-server (PostgreSQL) and logging-microservice for all operations.

**UI (profile selector and saved searches):** When the user has a JWT (same token as admin: save in [Admin](public/admin.html) or pass `?token=…` in the URL), the **landing** (`index.html`) shows "Who is this for?" with a profile dropdown; the **test page** (`test.html`) shows the same profile selector and a "Saved searches" block (list, Run, Add/Edit/Delete). Run creates a session and redirects to the test page with results. Create session and query/feedback requests send the selected `profileId` when set.

---

## 2. Architecture overview

### 2.1 Stack

- **Backend:** NestJS (TypeScript), Prisma, PostgreSQL (shared database-server).
- **Frontend (MVP):** Static HTML/JS in `public/` (landing, test, debug).
- **Required integrations:** **ai-microservice** (ASR, LLM, agent orchestration), **auth-microservice** (JWT, userId), **database-server** (PostgreSQL), **logging-microservice** (central logs). See README and [INTEGRATION.md](INTEGRATION.md).
- **External:** Search API (e.g. Serper), optional Leads microservice.

### 2.2 Agent types (schema / docs)

| Type              | Purpose (from schema/docs)                      |
|-------------------|-------------------------------------------------|
| **SEARCH**        | Browse internet, search for goods               |
| **COMPARISON**    | Compare prices                                  |
| **LOCATION**      | Work with locations (delivery, region)          |
| **COMMUNICATION** | Communicate with the user (query refinement)    |
| **PRESENTATION**  | Present results (dialog, tables, photos, video) |

Each agent is configured in the **admin panel** as a **prompt set**: name (e.g. "Communication Agent Polite"), **type**, **model** (from ai-microservice), **role**, and **prompt** text. The system uses these when calling the AI.

**Switching between agent sets (by role):** To use different behaviour for the same agent type (e.g. "Communication Agent Polite" vs "Communication Agent Strict"), create multiple prompts with the same **agent type** but different **name** and **role**. The backend selects the active prompt via `getActivePromptForAgent(agentType, role)`; `role` defaults to `default`. Only one active prompt per (agentType, role) is used (first by sortOrder). To switch sets: in Admin → Prompts, set the desired prompt as **Active** and deactivate others for that type+role, or use different roles (e.g. `default`, `premium`) and ensure the calling code passes the desired role when requesting the prompt.

### 2.3 Data flow (current MVP)

1. **User** submits a request (landing form or test form) → creates session, submits query.
2. **COMMUNICATION** agent (via ai-microservice) refines the query from user text.
3. **SEARCH** agent runs external search (e.g. Serper); results are stored.
4. **PRESENTATION** (planned): format results for the user (dialog, tables, photos).
5. User can send **feedback** (refine) or **choose a product** → redirect to merchant URL.

Agent-to-agent communication is logged in `AgentCommunication` and is intended to be inspected via the **admin panel** (Agent communication flow). Any debug views that expose agent-to-agent logs must be treated as internal tools, not part of the public UX.

### 2.4 Ports and deployment

- **Port range:** 45xx (e.g. `PORT=4500` blue, `PORT_GREEN=4501` green).
- **Deployment:** `./scripts/deploy.sh` → uses nginx-microservice `deploy-smart.sh shop-assistant`. Do not edit production nginx by hand; config is regenerated on deploy.
- **Domain:** Set `DOMAIN` in `.env` (e.g. `shop-assistant.alfares.cz`).

---

## 3. Repository layout

```text
shop-assistant/
├── docs/                    # Documentation
│   ├── DEVELOPMENT.md       # This file
│   ├── API.md               # REST API reference
│   ├── DEPLOYMENT.md        # Deploy steps
│   ├── INTEGRATION.md       # Microservices integration
│   ├── MODEL_AND_ROLE_MANAGEMENT.md
│   ├── AI_VERIFICATION_PROMPT.md   # Checklist for implementation verification
│   └── IMPLEMENTATION_PLAN.md      # Gaps and fix plan
├── prisma/
│   ├── schema.prisma        # DB schema (Session, Message, SearchRun, AgentPrompt, etc.)
│   └── migrations/
├── public/                  # Static frontend (MVP)
│   ├── index.html          # Landing (main request form at top, "I want it", prefilled text)
│   ├── test.html            # Test UI (session, query, progress, intermediary/final results, communication panel)
│   ├── debug.html           # Agent communications + client messages
│   ├── admin.html           # Admin UI (JWT): Prompts CRUD, AI Models, Agent flow
│   ├── privacy.html, cookies.html, terms.html
│   └── legal.css
├── scripts/
│   ├── deploy.sh            # Blue/green deploy
│   └── docker-entrypoint.sh
├── src/
│   ├── admin/               # Admin API: prompts CRUD, ai-models list
│   ├── auth/                # JWT validation (auth-microservice)
│   ├── sessions/            # Sessions, query, feedback, search, AI, agent logging
│   ├── leads/               # Lead submit (proxy to leads-microservice)
│   ├── legal/                # Legal pages proxy
│   ├── logging/             # Central logging client
│   └── prisma/              # Prisma service
├── .env.example             # Keys only (no secrets)
├── docker-compose*.yml
├── nginx-api-routes.conf    # Routes for nginx-microservice deploy
└── README.md
```

---

## 4. Environment and configuration

- **Single source of truth:** `.env`. No hardcoded URLs, API keys, or credentials.
- **Before changing .env:** Back up the existing file. Add any new **keys** (no values) to `.env.example`.
- **Required / common variables:** See `.env.example`. Include:
  - `DATABASE_URL`, `DB_*` (shared PostgreSQL)
  - `LOGGING_SERVICE_URL`
  - `AUTH_SERVICE_URL`, `JWT_SECRET` (admin + optional session auth)
  - `AI_SERVICE_URL` (models and ASR use ai-microservice at this URL only)
  - Search is via ai-microservice; no SEARCH_API_* in shop-assistant.
  - `LEADS_SERVICE_URL` (optional)
  - `DOMAIN`, `PORT`, `PORT_GREEN`
  - Legal/company vars for landing (see README).

---

## 5. Development workflow

1. **Read docs first:** README.md, this file, API.md, IMPLEMENTATION_PLAN.md.
2. **Local run:** Install deps, set `.env`, run Prisma migrate, start Nest (see README/package.json).
3. **Changes:** Implement in codebase only (no changes to database-server, auth-microservice, nginx-microservice, logging-microservice unless permitted).
4. **Logging:** Use the central logging service for all important operations and errors.
5. **Plan updates:** When a task is done, update IMPLEMENTATION_PLAN.md (e.g. mark items ✅) and adjust docs if needed.

---

## 6. MVP scope (first stage)

- **Landing:** Production-like landing with a **main request form at the top** and an **"I want it"**-style submit. Prefilled text for faster testing:  
  `"Find a red silk skirt size 52, 48 cm long. Find a shop which delivers in the Czech Republic. Find the best quality skirt with the cheapest price and delivery."`
- **Voice:** Not in MVP; text only.
- **User communication UI:** The public frontend exposes a **single communication UI** (chat) with the Communication AI agent. This UI is the only place where end users see AI responses; any internal multi-agent communication (SEARCH, COMPARISON, LOCATION, PRESENTATION, etc.) must remain hidden from the public UI.
- **Progress:** User sees **search status and intermediary results** (e.g. only skirt photos) to narrow parameters before final results.
- **Result:** User sees **photos + total price**, chooses one → click → redirect to product URL.
- **Admin panel:** CRUD for **models** (from ai-microservice), **AI agents** (prompt sets), and **prompts**. View **agent communication flow** (tasks, prompts, full flow) for development and tuning. The admin panel (Agent communication flow) is the **single place** to inspect internal AI workflows; do not expose agent-to-agent communication in the public UX.
- **Agent sets:** Named configurations, e.g. "Communication Agent Polite" / "Communication Agent Strict" with `{ type, model, prompt }`. In admin, create prompts with **Name**, **Agent type**, **Model**, **Role** (e.g. `default`). The app uses `getActivePromptForAgent(agentType, role)`; use role to switch sets (e.g. `default` vs `premium`).
- **Agents:** Can "contract" with each other (task handoffs logged in `AgentCommunication` with messageType e.g. `task`, `request`, `response`); full flow visible in **Admin → Agent communication flow** only. Agent execution mode can be switched between **sync** (Option B, direct calls) and **queue** (Option A, in-memory queue with limited concurrency) via **Admin → Execution mode** or `AGENT_EXECUTION_MODE` env (`sync` / `queue`).

---

## 7. Key flows to implement / verify

- **Request flow:** User submits request → Communication agent analyzes → creates task for Search agent → Search returns (e.g. photos) → Presentation agent presents to user → Communication agent informed.
- **Chat flow:** User replies in chat → Communication agent assigns tasks to other agents → results shown (dialog/tables/photos/video) → cycle continues.
- **Admin:** Configure agent types, models, prompts; view per-session agent communications and prompts for debugging and fine-tuning.

Use [AI_VERIFICATION_PROMPT.md](AI_VERIFICATION_PROMPT.md) to verify that all of the above are implemented correctly, and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) to track and fix missing parts.

---

## 8. Business requirements coverage

This section maps the original business requirements to documentation and implementation. Use it to verify that docs contain everything from the business requirements.

| Business requirement | Where documented | Implementation status |
|----------------------|------------------|-------------------------|
| AI shop assistant helping users buy products | §1 Project purpose, README | Done |
| Scenario: red silk skirt size 52, 48 cm, Czech delivery, best quality + cheapest price | §1, §6 MVP scope, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §1 | Partial (backend; landing form not at top) |
| Landing: form at top to type request | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §1.1 | Not done |
| Voice dictation (optional from start; MVP text only) | README, §6 MVP scope | Text only in MVP |
| Button «I want it» | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §1.1 | Not done on landing |
| Prefilled text (exact sentence for MVP) | §6 MVP scope, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §1.2 | Not on landing (test.html has different text) |
| Progress: search status and intermediary results | §6, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §2 | Partial / Not done |
| Intermediary results (e.g. photos to discuss color, size) | §6, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §2.2 | Not done |
| End: photos with total price, click → product URL | §6, [API.md](API.md) choice/redirect, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §2.3 | Partial (API done; UI list-based) |
| Agent types: SEARCH, COMPARISON, LOCATION, COMMUNICATION, PRESENTATION (with purposes) | §2.2 table, [API.md](API.md), [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md) | Schema + COMMUNICATION/SEARCH in flow; others planned |
| Single user-facing communication UI (chat) while keeping internal multi-agent flow hidden | §6 MVP scope, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §3 | Planned |
| Admin panel: setup agents, CRUD for prompts, list/assign models from ai-microservice | [API.md](API.md) Admin, [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §6 | Done (admin.html with prompts CRUD, models, execution mode, agent flow) |
| Each agent: AI model (from ai-microservice), Role, Prompt | §2.2, [API.md](API.md), [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md) | Done (AgentPrompt schema) |
| Agents communicate (queue or handoffs); see tasks, prompts, flow in admin | §2.3, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §4, §6.4, §8 | Handoffs logged; debug view; admin flow view planned |
| Use case: request → Communication → task to Search → Search → Presentation → user chat → Communication informed; user reply → cycle | §7 Key flows, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §4 | Partial (Communication→Search done; Presentation not wired) |
| Named agent sets (e.g. Communication Agent Polite/Strict): type, model, prompt | §2.2, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §7, [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md) | Done (name, agentType, model, role, content) |
| Agents can make contracts for parallel work (queue or handoffs visible) | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §8 | Option B: handoffs in AgentCommunication; queue optional later |
| **Initial-stage: priorities** (price, quality, location) for comparison | §1.1, README, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §10 | Planned (COMPARISON/LOCATION wiring) |
| **Initial-stage: multi-product search** (several products in one request) | §1.1, README, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §10 | Planned |
| **Initial-stage: multi-user per account** (profiles: mom, dad, child) | §1.1, README, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §10 | Planned (auth userId + profiles in DB) |
| **Initial-stage: saved search criteria** (save and reuse criteria) | §1.1, README, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §10 | Planned |

**Note:** “CRUD for models” in business requirements means: list/select AI models from ai-microservice and assign one to each agent (prompt). Models are not created/deleted in shop-assistant; only prompt configurations (agent type, name, model, role, prompt) have full CRUD. See [API.md](API.md) and [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md).

---

## 9. References

- Repository root: **README.md**, **CREATE_SERVICE.md** (ecosystem and new-service rules)
- Shop-assistant: [README.md](../README.md), [API.md](API.md), [DEPLOYMENT.md](DEPLOYMENT.md), [INTEGRATION.md](INTEGRATION.md), [MODEL_AND_ROLE_MANAGEMENT.md](MODEL_AND_ROLE_MANAGEMENT.md)
- Verification and plan: [AI_VERIFICATION_PROMPT.md](AI_VERIFICATION_PROMPT.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)
