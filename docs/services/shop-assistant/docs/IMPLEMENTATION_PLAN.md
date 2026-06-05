# Shop Assistant — Implementation Plan (Fix Not-Finished Parts)

This document lists **gaps** between current implementation and the product requirements, and a **plan to fix** them. Update it as tasks are completed (mark with ✅). Keep it aligned with [AI_VERIFICATION_PROMPT.md](AI_VERIFICATION_PROMPT.md) and [DEVELOPMENT.md](DEVELOPMENT.md).

**Verification:** A full requirement check was run per [AI_VERIFICATION_PROMPT.md](AI_VERIFICATION_PROMPT.md). See **[VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)** for per-requirement status. The plan table below is the source of truth for what is done (✅) vs pending (⬜).

---

## Current state summary

- **Backend:** Sessions, query, feedback, search (Serper), AI refinement (ai-microservice), agent communication logging, prompts CRUD, ai-models list. **COMPARISON, LOCATION, PRESENTATION are wired** into the main session flow (comparePrices, extractDeliveryRegion, formatResultsForPresentation). Execution mode (sync/queue) configurable in admin; AgentQueueService used when mode is queue.
- **Frontend:** Landing (`index.html`) with main request form at top, "I want it" button, prefilled text; submit creates session → POST query → redirect to test. Test (`test.html`) has progress steps, intermediary results (photos, Refine + "See full list with prices"), final results with price and "Go to product" (choice/redirect API), and a **single communication panel** (chat) for user/assistant messages. Debug (`debug.html`) for internal agent communications. **Admin UI** (`admin.html`) with JWT: Prompts CRUD, AI Models, Execution mode, Agent communication flow.
- **Agents:** COMMUNICATION, SEARCH, COMPARISON, LOCATION, PRESENTATION are used in the flow. Internal agent handoffs logged in `AgentCommunication`; visible in admin (Agent flow tab) and debug (internal tooling only).

---

## Plan (tasks)

### 1. Landing: main form at top + "I want it" + prefilled text

| # | Task | Status |
|---|------|--------|
| 1.1 | Add a **main request form at the very top** of the landing (above hero or in hero) with one text field and a submit button labeled **"I want it"** (or equivalent). | ✅ |
| 1.2 | On submit: create session (if needed), POST query to `/api/sessions/:id/query`, then redirect or show progress/results (see section 3). | ✅ |

---

### 2. Progress and intermediary results

| # | Task | Status |
|---|------|--------|
| 2.1 | After "I want it", show **progress** (e.g. "Analyzing request…", "Searching…", "Preparing results…"). | ✅ |
| 2.2 | Show **intermediary results** (e.g. product photos only) so the user can discuss and narrow (color, size) before final list. | ✅ |
| 2.3 | Final step: show **photos with total price**; user **clicks one** → go to product URL (existing choice/redirect API). | ✅ |

**Notes:** May require backend support for "stages" (e.g. photos-only run vs final run) or multiple search/refinement steps; and frontend to display stages and intermediary vs final results.

---

### 3. User-facing communication vs internal agent flow

| # | Task | Status |
|---|------|--------|
| 3.1 | Provide a **single user-facing communication UI** (chat with the Communication agent) as the main interaction surface. Do **not** show a separate internal/output window next to the user’s requests. | ✅ |
| 3.2 | Ensure that **internal multi-agent communication (SEARCH, COMPARISON, LOCATION, PRESENTATION, etc.) is never shown in the public UI**; it must be visible only via the admin panel (Agent communication flow). | ✅ |
| 3.3 | Communication UI can render rich content from the Presentation agent (dialog, tables, photos, video previews), but this content must appear as part of the single assistant conversation, not as a separate debug window. | ✅ |

**Notes:** Backend already has messages and agent communications; internal agent handoffs are logged in `AgentCommunication` and should be inspected via the admin panel only. Frontend focuses on a single Communication-agent chat for users; any additional debug views must be treated as internal/admin-only tooling, not part of the production UX.

---

### 4. Use case: Communication → Search → Presentation

| # | Task | Status |
|---|------|--------|
| 4.1 | **Communication agent** explicitly creates a **task** for **Search agent** (e.g. "find N product photos for red skirts"); ensure this is logged in `AgentCommunication`. | ✅ |
| 4.2 | When Search has results, **Search agent** asks **Presentation agent** to format them (dialog/tables/photos). | ✅ |
| 4.3 | **Presentation agent** returns formatted content to the user chat and notifies **Communication agent** (logged in `AgentCommunication`). | ✅ |
| 4.4 | User reply in chat → Communication agent assigns new tasks to other agents; cycle continues. | ✅ |

**Notes:** COMMUNICATION→SEARCH task/request logged; after search, SEARCH→PRESENTATION request and PRESENTATION→COMMUNICATION response logged. `AiService.formatResultsForPresentation()` uses PRESENTATION prompt (placeholders `{{searchResults}}`, `{{queryText}}`); assistant message uses formatted content. Feedback flow logs task and uses same Presentation step.

---

### 5. COMPARISON and LOCATION agents

| # | Task | Status |
|---|------|--------|
| 5.1 | Use **COMPARISON** agent when comparing prices (e.g. after search or when user asks for comparison). | ✅ |
| 5.2 | Use **LOCATION** agent for delivery/region (e.g. "delivers in the Czech Republic"). | ✅ |

**Notes:** COMPARISON is called after each search (query and feedback); output is appended to the assistant message. LOCATION is called after COMMUNICATION refines the query; if the prompt returns a short reply (e.g. "delivery Czech Republic"), it is appended to the search query. Configure prompts in admin (placeholders: COMPARISON — `{{searchResults}}`, `{{queryText}}`; LOCATION — `{{userInput}}`, `{{queryText}}`).

---

### 6. Admin panel (UI)

| # | Task | Status |
|---|------|--------|
| 6.1 | Provide an **admin UI** (e.g. under `/admin` or separate route) with auth (JWT). | ✅ |
| 6.2 | Admin UI: **CRUD for prompts** (agent type, name, model, role, prompt text). | ✅ |
| 6.3 | Admin UI: **list/select AI models** from ai-microservice (use existing `GET /api/admin/ai-models`). | ✅ |
| 6.4 | Admin UI: **view agent communication flow** (e.g. list sessions, select session, show agent communications + prompts used). | ✅ |

**Notes:** `public/admin.html` — JWT in sessionStorage (or `?token=…` in URL); tabs: Prompts CRUD, AI Models list, Agent flow (session ID input → load agent communications). Prompts and AI models require valid JWT; agent flow uses public `/api/sessions/:id/agent-communications` and is the **only supported place** to inspect internal multi-agent communication in the production UX.

---

### 7. Agent sets (named configurations)

| # | Task | Status |
|---|------|--------|
| 7.1 | Ensure **named agent sets** are supported (e.g. "Communication Agent Polite", "Communication Agent Strict") with **type**, **model**, **prompt** (already in `AgentPrompt`: name, agentType, model, content). | ✅ |
| 7.2 | Document or expose in admin how to switch between sets (e.g. by role or by name). | ✅ |

**Notes:** Admin UI supports creating/editing prompts with name, agentType, model, role, content. Multiple prompts per agent type (e.g. different names/roles) are selected by `getActivePromptForAgent(agentType, role)`; role defaults to `default`; document in admin copy or DEVELOPMENT.md.

---

### 8. Agent contracts / queue (parallel work)

| # | Task | Status |
|---|------|--------|
| 8.1 | Option A: Introduce a **queue** (e.g. in-memory queue, later RabbitMQ) so agents can post tasks and consume asynchronously for parallel work. | ✅ |
| 8.2 | Option B: Keep synchronous handoffs but **document** "contracts" as task handoffs logged in `AgentCommunication` and visible in admin. | ✅ |

**Notes:** Agent handoffs are logged in `AgentCommunication` (COMMUNICATION→SEARCH, SEARCH→COMPARISON, etc.) and visible in admin (Agent flow tab) and debug view. **Execution mode** (Option A vs B) is configurable in admin (`admin.html` → *Execution mode* tab) and via `AGENT_EXECUTION_MODE` env (`sync` / `queue`). When `mode = queue`, SEARCH calls run through an in-memory `AgentQueueService` with limited concurrency (`AGENT_QUEUE_CONCURRENCY`, default 3); when `mode = sync`, existing synchronous behaviour is used. External queues (e.g. RabbitMQ) can replace the in-memory queue in future without changing the admin UX.

---

### 9. Documentation updates

| # | Task | Status |
|---|------|--------|
| 9.1 | After each completed task, **update** README or docs if behavior or API changed. | ✅ |
| 9.2 | Keep **IMPLEMENTATION_PLAN.md** updated: mark completed items with ✅. | ✅ |

---

### 10. Business requirements (initial stage): priorities, multi-product, multi-user, saved criteria

These requirements are documented in README and [DEVELOPMENT.md](DEVELOPMENT.md) §1.1. Implementation uses **ai-microservice**, **auth-microservice**, **database-server**, **logging-microservice** (see README “Required integrations”).

| # | Task | Status |
|---|------|--------|
| 10.1 | **Priorities (price, quality, location):** Store user priority order/weights (e.g. price first, then quality, then location) in session or query params; wire **COMPARISON** agent to rank/filter results by these; wire **LOCATION** agent for delivery region. | ✅ |
| 10.2 | **Multi-product search:** Use ai-microservice LLM to split user text into N search intents; run N searches (parallel or batched); group results by product type in response; extend session/search-run model if needed (e.g. multiple query texts per run). | ✅ |
| 10.3 | **Multi-user per account:** Add **AccountProfile** (or equivalent) in DB: userId, name, role (e.g. mom/dad/child). Session or query carries optional profileId; auth-microservice provides userId. Add profile selector in UI. | ✅ |
| 10.4 | **Saved search criteria:** Add model **SavedSearchCriteria** (userId, name, priorities JSON, productTypes/intents JSON, profileId optional, filters JSON). CRUD API; “Run saved search” creates session and applies criteria. Use database-server and logging-microservice. | ✅ |
| 10.5 | Document and log all new flows via logging-microservice; ensure no hardcoded values (use .env). | ✅ |

**Notes:** Do not modify database-server, auth-microservice, nginx-microservice, or logging-microservice; integrate via their APIs and scripts only. See [INTEGRATION.md](INTEGRATION.md).

---

## Completion log

- **Created:** Implementation plan and development docs, AI verification prompt.
- **Verification run:** [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) produced (per AI_VERIFICATION_PROMPT.md).
- **Sections 1–5, 7, 9:** Landing main form + "I want it" + prefilled text; submit → create session, POST query, redirect to test. Test page: progress steps, intermediary results (Refine + "See full list with prices"), final results with price and "Go to product"; single communication panel (chat); internal agent flow only in admin/debug. Communication → Search → Presentation flow and COMPARISON/LOCATION wired in backend. Named agent sets (name, type, model, role) and switching by role documented in DEVELOPMENT.md and admin UI. Documentation and plan kept updated.
- **Sections 6, 8, 10:** Admin UI (JWT), Prompts CRUD, AI Models, Execution mode, Agent flow; queue vs sync; priorities, multi-product, profiles, saved criteria (backend + APIs; UI wiring where noted).
- **Profile and saved-criteria UI:** When user has JWT (same token as admin: save in Admin or pass `?token=`), landing and test page show "Who is this for?" profile selector; test page shows "Saved searches" (list, Run, Add/Edit/Delete). Run redirects to test with sessionId; profileId is sent on session create and query/feedback.
- **10.3 Profile selector UI (all surfaces):** Landing: profile row + hint when no token ("Optional: sign in… to choose who this search is for"). Test: profile dropdown in Test Query form (and Account section); both dropdowns synced; `getProfileId()` reads from query form first. Admin: **Profiles** tab with list (Refresh), Add/Edit/Delete profiles (name, role). Test page "View in Admin (agent flow)" link id fixed to `adminFlowLink`.
- **Multi-product UI (10.2):** test.html shows **groups** when the API returns `groups`. When loading by sessionId (e.g. from landing redirect), `loadResultsForSession` fetches up to 10 runs, treats runs from the same second as one multi-product batch, builds `groups` from them, and displays the "Grouped by product" block so grouped view works from results history too.
- **Next:** Any further UX polish or external queue (e.g. RabbitMQ) if desired.

### Verification: new (initial-stage) requirements (10.1–10.5)

Checked against codebase and docs; all are implemented:

| Requirement | Evidence |
|-------------|----------|
| **10.1 Priorities** | `Session.priorityOrder`; create/query/feedback DTOs accept `priorities`; `sessions.service` passes `priorityOrder` to `comparePrices()` and `extractDeliveryRegion()`; COMPARISON/LOCATION prompts use `{{priorityOrder}}`. |
| **10.2 Multi-product** | `AiService.splitIntoSearchIntents()`; `submitQuery` runs parallel searches per intent, returns `groups`; API and test.html display grouped results. |
| **10.3 Multi-user** | `AccountProfile` model; `GET/POST/PUT/DELETE /api/profiles` (JWT); `Session.profileId`; landing and test show "Who is this for?" profile selector when JWT present. |
| **10.4 Saved criteria** | `SavedSearchCriteria` model; `GET/POST/PUT/DELETE /api/saved-criteria` and `POST /api/saved-criteria/:id/run` (JWT); test page: Saved searches list, Run, Add/Edit/Delete. |
| **10.5 Doc + logging** | API.md documents profiles and saved-criteria; logging used in profiles and saved-criteria services; config via .env. |

---

## References

- Requirements source: user request (AI shop assistant, landing form, "I want it", prefilled text, progress, intermediary results, communication form, admin panel, agent types, use case Communication → Search → Presentation, agent sets, contracts; initial-stage: priorities, multi-product search, multi-user per account, saved search criteria).
- Required integrations: ai-microservice, auth-microservice, database-server, logging-microservice (README, [INTEGRATION.md](INTEGRATION.md)).
- Verification: [AI_VERIFICATION_PROMPT.md](AI_VERIFICATION_PROMPT.md).
- Development: [DEVELOPMENT.md](DEVELOPMENT.md), [README.md](../README.md), [API.md](API.md).
