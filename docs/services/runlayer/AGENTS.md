# Agents: runlayer (Project OS)

## Knowledge Retrieval (query before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`

## Coordinator Config

```yaml
model_tier: cheap
cycle_interval_minutes: 60
max_tasks_per_cycle: 10
state_debounce_minutes: 5
```

## GlobalCoordinator Config

```yaml
model_tier: smart
tick_interval_minutes: 15
max_businesses_per_tick: 50
leader_lease_ttl_seconds: 60
```

## Worker Pool Config

```yaml
max_concurrent_workers: 20
default_model_tier: free
allowed_mcp_servers: [filesystem, postgres]
worker_timeout_ms: 900000
heartbeat_interval_seconds: 30
```

## Validator Config

```yaml
model_tier: free
semantic_validation_tier: cheap
schema_validation: deterministic
max_revision_attempts: 2
```

## Model Tier → Model Mapping

Routing is handled by LiteLLM proxy (`ai-microservice-litellm-{blue|green}`).  
Config: `ai-microservice/litellm_config.yaml`. Requires container restart after changes.

```yaml
free:   ollama/qwen2.5-coder:0.5b        # primary
        → cheap (fallback if Ollama slow/unavailable)
cheap:  openrouter/google/gemma-3-27b-it:free  # primary
        → ollama/qwen2.5-coder:0.5b       # fallback
smart:  gemini/gemini-2.0-flash           # primary
        → ollama/qwen2.5-coder:0.5b       # fallback
```

> **Important:** All prompts to `/ai/complete` must merge instructions into `user_prompt`.
> Do NOT use the `system_prompt` field — free/cheap tier models reject it with HTTP 400.
> See `src/worker/worker-agent.service.ts` and `src/coordinator/project-coordinator.service.ts`
> for the correct pattern.

## Prompt rules (enforced in code)

- Worker system prompt: merged into `user_prompt` as prefix (no `system_prompt` field)
- Coordinator system prompt: merged into `user_prompt` as prefix
- Validator semantic review: merged into `user_prompt` as prefix
- Acceptance criteria: natural-language strings are valid — validator routes unknown ones to LLM review
- `output_ref` field required in worker response; validator checks `json_valid` + `output_present` by default

## Active Agents

<!-- Coordinator-maintained. Do not edit manually. -->
No agents active — system not yet deployed.
