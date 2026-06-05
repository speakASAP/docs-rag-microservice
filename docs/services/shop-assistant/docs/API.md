# Shop Assistant API

Base path: `/api` (global prefix). Health: `/health` (no prefix).

## Sessions

### Create session

- **POST** `/api/sessions`
- Body: `{ "userId": "optional-string", "priorities": ["price", "quality", "location"], "profileId": "optional-profile-id" }`
- `priorities` (optional): user priority order; allowed values: `"price"`, `"quality"`, `"location"`. Stored on session and used by COMPARISON and LOCATION agents (10.1).
- `profileId` (optional): account profile id (see Profiles API). When provided, the session is linked to that profile (10.3).
- Response: `{ "sessionId": "uuid" }`

### Submit query (voice or text)

- **POST** `/api/sessions/:id/query`
- Body: `{ "text": "optional search text", "audioUrl": "optional URL to audio file", "priorities": ["price", "quality", "location"], "profileId": "optional-profile-id" }`
- `priorities` (optional): same as create session; updates session if provided. COMPARISON agent ranks/filters by these; LOCATION uses them for delivery region.
- `profileId` (optional): when provided, updates the session profile reference (10.3).
- If `audioUrl` is provided, ASR (ai-microservice) transcribes first; then LLM refines query; then external search runs.
- Response: `{ "results": [ ... ], "queryText": "..." [, "groups": [ { "queryText": "...", "results": [ ... ] } ] ] }`. When the user request is split into multiple product intents (10.2 multi-product), `groups` is present and each element is one product type with its results; `results` is the flattened list.

### Submit feedback (refine search)

- **POST** `/api/sessions/:id/feedback`
- Body: `{ "message": "string", "selectedIndices": [ 0, 2 ], "priorities": ["price", "quality", "location"], "profileId": "optional-profile-id" }`
- `priorities` (optional): same as create session; updates session if provided.
- `profileId` (optional): when provided, updates the session profile reference (10.3).
- LLM refines constraints; search runs again; new results returned.
- Response: same shape as query.

### Get results history

- **GET** `/api/sessions/:id/results?page=1&limit=20`
- Response: `{ "items": [ { "id", "queryText", "createdAt", "results": [ ... ] } ], "pagination": { "page", "limit", "total" } }`
- Max 30 items per page.

### Get client messages (debug)

- **GET** `/api/sessions/:id/messages`
- Response: `{ "messages": [ { "id", "role", "contentType", "content", "createdAt" } ] }`
- Returns all client-assistant messages for a session, ordered by creation time.

### Get agent communications (debug)

- **GET** `/api/sessions/:id/agent-communications`
- Response: `{ "communications": [ { "id", "fromAgent", "toAgent", "messageType", "content", "metadata", "createdAt" } ] }`
- Returns all agent-to-agent communication logs for debugging purposes. Shows which agents communicate with each other and what they exchange.

### Choose product (get URL)

- **GET** `/api/sessions/:id/choice/:productId`
- Response: `{ "url": "https://merchant.example/product/123" }`

### Choose product (302 redirect)

- **GET** `/api/sessions/:id/choice/:productId/redirect`
- Responds with 302 redirect to the product URL.

## Leads (leave request via form or voice)

Same flow as statex: all requests are saved on the server, then sent to leads-microservice and to ai-microservice for analysis.

- **POST** `/api/leads/submit`
- Body: multipart/form-data or JSON with `message`, `name`, `contactMethods` (or `contact_type`/`contact_value`), optional `voice_file`, optional `files[]`.
- Flow: (1) Request is saved to local DB (LeadRequest), (2) forwarded to leads-microservice, (3) same data sent to ai-microservice `POST /api/process-submission` for analysis, (4) saved record updated with `leadId` and `aiSubmissionId`.
- Response: `{ "leadId", "status", "confirmationSent", "requestId", "aiSubmissionId" }`.

## Admin (JWT required)

All admin endpoints require `Authorization: Bearer <accessToken>` (JWT from auth-microservice).

### AI Agent Prompts

Agent types: `SEARCH` (browse/search goods), `COMPARISON` (compare prices), `LOCATION` (locations), `COMMUNICATION` (user communication), `PRESENTATION` (present results in different formats). Prompts and chosen AI model are used by ai-microservice for all LLM requests. Placeholders: COMMUNICATION — `{{userInput}}`, `{{previousParams}}`; PRESENTATION — `{{searchResults}}`, `{{queryText}}`; COMPARISON — `{{searchResults}}`, `{{queryText}}` (used after search to compare prices; output appended to assistant message); LOCATION — `{{userInput}}`, `{{queryText}}` (used to extract delivery region; short reply is appended to search query).

- **GET** `/api/admin/prompts?agentType=SEARCH`
  - List all prompts or filter by `agentType`. Response: `{ "items": [ { "id", "agentType", "name", "content", "model", "role", "isActive", "sortOrder", "createdAt", "updatedAt" } ] }`
- **GET** `/api/admin/prompts/:id`
  - Get one prompt by id.
- **POST** `/api/admin/prompts`
  - Body: `{ "agentType", "name", "content", "model": "optional model id (e.g. google/gemini-2.0-flash-exp:free)", "role": "optional, e.g. default|premium", "isActive", "sortOrder" }`
  - Create a prompt.
- **PUT** `/api/admin/prompts/:id`
  - Body: same fields as create (all optional). Update a prompt.
- **DELETE** `/api/admin/prompts/:id`
  - Delete a prompt.

### AI Models (for admin prompt model dropdown)

- **GET** `/api/admin/ai-models?free_only=true&context_min=100000&limit=3&provider=openrouter`
  - Returns unified list of all available models from ai-microservice orchestrator (fetched from source APIs: OpenRouter, Gemini, etc.)
  - **Query Parameters:**
    - `free_only` (boolean): Return only free models (default: false)
    - `context_min` (number): Minimum context window size in tokens
    - `limit` (number): Maximum number of models to return per provider
    - `provider` (string): Filter by specific provider (e.g., "openrouter", "gemini")
  - Response: `{ "models": { "provider": [ { "id", "name", "description", "context_length", "pricing": { "prompt", "completion", "free" }, "capabilities" } ] }, "providers": { "provider": { "status" } }, "modelList": [ { "provider", "name", "description", "context_length", "pricing" } ] }`
  - Uses `AI_SERVICE_URL` (orchestrator). Models are fetched from source APIs (OpenRouter, Gemini) in real-time.

### Admin Settings (agent execution mode)

- **GET** `/api/admin/settings/agent-execution-mode`
  - Returns current agent execution mode for internal agent tasks: `{ "mode": "sync" | "queue" }`.
  - `sync` = direct in-process calls (Option B: synchronous handoffs).
  - `queue` = use in-memory `AgentQueueService` with limited concurrency (Option A: queue-based parallel work).
- **PUT** `/api/admin/settings/agent-execution-mode`
  - Body: `{ "mode": "sync" | "queue" }`.
  - Updates the execution mode at runtime (per service instance). Requires JWT.

Environment variables:

- `AGENT_EXECUTION_MODE` — default execution mode (`sync` or `queue`). If not set or invalid, defaults to `sync`.
- `AGENT_QUEUE_CONCURRENCY` — maximum number of queued agent jobs (SEARCH calls) run in parallel when mode is `queue` (default: 3).

## Health

- **GET** `/health`
- Response: `{ "status": "ok" }`

---

## Profiles (multi-user per account, JWT required)

These endpoints manage account-level profiles (e.g. Mom/Dad/Child) used to scope sessions and saved criteria (10.3).

- **GET** `/api/profiles`  
  - Returns all profiles for the authenticated user.  
  - Response: `{ "items": [ { "id", "userId", "name", "role", "createdAt", "updatedAt" } ] }`

- **POST** `/api/profiles`  
  - Body: `{ "name": "string", "role": "optional string (e.g. mom|dad|child)" }`  
  - Creates a new profile for the authenticated user.

- **PUT** `/api/profiles/:id`  
  - Body: `{ "name"?: "string", "role"?: "string|null" }`  
  - Updates name/role of a profile owned by the authenticated user.

- **DELETE** `/api/profiles/:id`  
  - Deletes a profile owned by the authenticated user. Existing sessions and saved criteria keep a nullable reference.

Sessions may carry an optional `profileId` (see Sessions API). This id must belong to one of the user profiles returned by `/api/profiles`.

## Saved search criteria (JWT required)

These endpoints manage named saved search criteria templates (10.4).

- **GET** `/api/saved-criteria`  
  - Returns all saved criteria for the authenticated user.  
  - Response: `{ "items": [ { "id", "userId", "name", "priorities", "productIntents", "filters", "profileId", "createdAt", "updatedAt" } ] }`

- **GET** `/api/saved-criteria/:id`  
  - Returns one saved criteria owned by the authenticated user.

- **POST** `/api/saved-criteria`  
  - Body:  

    ```json
    {
      "name": "Kids school clothes",
      "priorities": ["price", "quality", "location"],
      "productIntents": ["red skirt size 52", "winter boots size 42"],
      "filters": { "delivery": "Czech Republic" },
      "profileId": "optional-profile-id"
    }
    ```  

  - Creates a saved criteria template. JSON fields are stored as-is and interpreted by the AI agents.

- **PUT** `/api/saved-criteria/:id`  
  - Body: same fields as create, all optional. `profileId` can be set to `null` to detach from a profile.

- **DELETE** `/api/saved-criteria/:id`  
  - Deletes a saved criteria owned by the authenticated user.

- **POST** `/api/saved-criteria/:id/run`  
  - Creates a new session and runs a search based on the saved criteria.  
  - Response: `{ "sessionId", "results", "queryText", "groups": [ { "queryText", "results": [...] } ] }`  
  - The service:
    - Uses `priorities` (if present) to set session priority order.  
    - Builds a free-text request from `productIntents` (or the criteria name) and passes it through the normal session flow (multi-product split, agents, etc.).  
    - Returns the same shape as `POST /api/sessions/:id/query`.
