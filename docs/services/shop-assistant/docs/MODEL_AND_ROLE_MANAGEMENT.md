# Model and Role Management for Shop Assistant

## Overview

The shop-assistant admin panel now supports selecting AI models and assigning roles to prompts. This allows administrators to configure different AI models and prompts for different use cases (e.g., improving search agent with a better model and prompt).

## Features

✅ **Fetch from Source APIs** - Models are fetched directly from source APIs (OpenRouter, Gemini) in real-time  
✅ **Filtering Support** - Filter models by price (free_only), context window (context_min), limit, and provider  
✅ **Unified Model List** - Single endpoint provides all available models from all AI services  
✅ **Model Selection** - Choose specific AI models for each prompt configuration  
✅ **Role-Based Prompts** - Assign prompts to specific roles (default, premium, etc.)  
✅ **Full CRUD Operations** - Create, read, update, and delete prompt configurations  
✅ **Automatic Model Usage** - System automatically uses the selected model when processing requests

## Architecture

### AI Microservice (ai-microservice)

**New Endpoint:**

`free-ai-service` (OpenRouter, Ollama, HuggingFace models)
`gemini-ai-service` (Gemini models)

**Response Format:**

{
  "models": {
    "openrouter": [
      {
        "id": "google/gemini-2.0-flash-exp:free",
        "name": "google/gemini-2.0-flash-exp:free",
        "description": "Google: Gemini 2.0 Flash Experimental (free)",
        "capabilities": []
      }
    ],
    "gemini": [
      {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "description": "Most balanced model with 1M token context window",
        "capabilities": ["text_generation", "reasoning", "analysis"]
      }
    ]
  },
  "providers": {
    "openrouter": "available",
    "gemini": {"status": "available"}
  },
  "modelList": [
    {
      "provider": "openrouter",
      "name": "google/gemini-2.0-flash-exp:free",
      "description": "Google: Gemini 2.0 Flash Experimental (free)"
    }
  ]
}

### Shop Assistant Admin Panel

**Endpoints:**

1. **Get Available Models**
   - `GET /api/admin/ai-models?free_only=true&context_min=100000&limit=3&provider=openrouter`
   - Returns all available models fetched from source APIs (OpenRouter, Gemini)
   - **Query Parameters:**
     - `free_only` (boolean): Return only free models (e.g., `?free_only=true`)
     - `context_min` (number): Minimum context window size in tokens (e.g., `?context_min=100000`)
     - `limit` (number): Maximum number of models per provider (e.g., `?limit=3`)
     - `provider` (string): Filter by provider (e.g., `?provider=openrouter` or `?provider=gemini`)
   - Requires JWT authentication
   - **Example:** `GET /api/admin/ai-models?free_only=true&limit=3` - Returns only 3 free models

2. **List Prompts**
   - `GET /api/admin/prompts?agentType=SEARCH`
   - Returns all prompts, optionally filtered by agentType
   - Response includes `model` and `role` fields

3. **Create Prompt**

   - `POST /api/admin/prompts`
   - Body:

     ```json
     {
       "agentType": "SEARCH",
       "name": "Enhanced Search Agent",
       "content": "Search for: {{userInput}}",
       "model": "google/gemini-2.0-flash-exp:free",
       "role": "premium",
       "isActive": true,
       "sortOrder": 0
     }
     ```

4. **Update Prompt**
   - `PUT /api/admin/prompts/:id`
   - Same body format as create (all fields optional)

5. **Delete Prompt**
   - `DELETE /api/admin/prompts/:id`

## Agent Types

- `SEARCH` - Browse internet, search for goods
- `COMPARISON` - Compare prices (used for user priorities: price, quality; see README and IMPLEMENTATION_PLAN.md §10)
- `LOCATION` - Work with locations and delivery region (used for location/delivery priority; see README and IMPLEMENTATION_PLAN.md §10)
- `COMMUNICATION` - Communicate with the user (currently used for query refinement)
- `PRESENTATION` - Present results in different formats

## Role System

- **Default Role**: If no role is specified or role is empty, it defaults to `"default"`
- **Role Matching**: When looking up prompts, the system:
  1. First tries to find a prompt for the exact role
  2. Falls back to `"default"` role if not found
  3. Matches both `role = "default"` and `role = null` as default

## Model Usage

1. The system retrieves the active prompt for the agent type and role

2. If the prompt has a model, it's included in the AI request
3. The AI microservice uses the specified model instead of auto-selecting

**Example Flow:**

```text

User Query → Get Active Prompt (COMMUNICATION, role="premium")
  → Prompt has model="google/gemini-2.0-flash-exp:free"
  → AI Request includes model parameter
  → AI Microservice uses specified model

```

## Prompt Placeholders

Use these placeholders in prompt content:

- `{{userInput}}` - Replaced with user's input text
- `{{previousParams}}` - Replaced with previous search parameters (JSON string)

## Example Use Cases

### 1. Improve Search Agent with Better Model

```json
POST /api/admin/prompts
{
  "agentType": "SEARCH",
  "name": "Advanced Search with Gemini",
  "content": "You are an expert shopping assistant. Search for products matching: {{userInput}}. Consider: {{previousParams}}",
  "model": "gemini-2.5-pro",
  "role": "premium",
  "isActive": true
}
```

### 2. Different Models for Different Roles

```json
// Default role - uses free model
POST /api/admin/prompts
{
  "agentType": "COMMUNICATION",
  "name": "Default Communication",
  "content": "Extract search query from: {{userInput}}",
  "model": "google/gemini-2.0-flash-exp:free",
  "role": "default"
}

// Premium role - uses better model
POST /api/admin/prompts
{
  "agentType": "COMMUNICATION",
  "name": "Premium Communication",
  "content": "Extract and refine search query from: {{userInput}}. Previous context: {{previousParams}}",
  "model": "gemini-2.5-pro",
  "role": "premium"
}
```

## Database Schema

```prisma
model AgentPrompt {
  id        String   @id @default(uuid())
  agentType AgentType
  name      String   @db.VarChar(255)
  content   String   @db.Text
  model     String?  @db.VarChar(255)  // AI model identifier
  role      String?  @db.VarChar(64)   // Role (default, premium, etc.)
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([agentType])
  @@index([agentType, isActive])
  @@index([agentType, role])
  @@index([agentType, role, isActive])

}
```

## Environment Variables

No new environment variables required. Uses existing:

- `AI_SERVICE_URL` - Points to AI orchestrator (models at `/models`, ASR at `/api/shop-assistant/transcribe`). Default: `http://ai-microservice:3380`

## Implementation Details

### AI Orchestrator (`ai-microservice/services/ai-orchestrator/app/main.py`)

- Added `/models` endpoint that aggregates models from all AI services
- Handles different response formats from different services
- Gracefully handles service failures (returns empty list if service unavailable)

### Shop Assistant (`shop-assistant/src/admin/`)

- `ai-models.controller.ts` - Fetches and formats models for admin panel
- `prompts.service.ts` - Handles CRUD operations with model/role support
- `prompts.controller.ts` - REST API endpoints for prompt management

- `ai.service.ts` - Uses model from prompt when making AI requests

## Testing

To test the implementation:

1. **Fetch Models:**

   ```bash
     http://localhost:4500/api/admin/ai-models
   ```

2. **Create Prompt with Model:**

   ```bash
   curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "agentType": "COMMUNICATION",
       "name": "Test Prompt",
       "content": "Process: {{userInput}}",
       "model": "google/gemini-2.0-flash-exp:free",
       "role": "default"
     }' \
     http://localhost:4500/api/admin/prompts
   ```

3. **Verify Model Usage:**
   - Check logs when making AI requests
   - Should see model being used in AI service logs

## Notes

- Model identifiers should match exactly what's returned from `/models` endpoint
- Empty or null model field means AI microservice will auto-select
- Role field defaults to "default" if not specified
- Multiple prompts can exist for same agentType/role (sorted by sortOrder)
- Only active prompts are used (isActive = true)
