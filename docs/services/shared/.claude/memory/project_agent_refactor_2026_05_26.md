---
name: project-agent-refactor-2026-05-26
description: "Active refactoring: Claude-only routing + JSON contracts + AWAITING_USER status. Three GitHub issues, three plan files. Execute in order: contracts → claude routing → awaiting_user."
metadata: 
  node_type: memory
  type: project
  originSessionId: 929952d1-cf49-47ed-baa3-41287ffa8302
---

## Active Refactoring: AI Agent System Overhaul (2026-05-26)

Three independent work items. Execute in this order to minimize dependencies.

**Why:** Token-economy routing (LiteLLM/Ollama) has been broken for 1 month. Replacing with Claude-only baseline to unblock multi-agent system testing. Contracts and human-in-the-loop added in same session.

### Item 1 — JSON Contracts (runlayer)
- **GitHub:** https://github.com/speakASAP/runlayer/issues/19
- **Plan:** `runlayer/docs/superpowers/plans/2026-05-26-agent-json-contracts.md`
- **Status:** NOT STARTED
- **What:** Add `src/contracts/` with Zod schemas (TaskPayload, AgentResult, ValidationRequest, ValidationResult, AiCompleteRequest/Response). Validate at worker intake + validator output + AI response.
- **How to apply:** Do this first — it defines interfaces the other two items conform to.

### Item 2 — Claude-Only Routing (ai-microservice)
- **GitHub:** https://github.com/speakASAP/ai-microservice/issues/1
- **Plan:** `ai-microservice/docs/superpowers/plans/2026-05-26-claude-only-routing.md`
- **Status:** NOT STARTED
- **What:** Rewrite `src/ai/ai.service.ts` to call `https://api.anthropic.com/v1/messages` directly with `claude-sonnet-4-6-20251001`. Remove LiteLLM/Ollama containers from K8s. `model_tier` field preserved in contract but ignored.
- **Key:** ANTHROPIC_API_KEY is already in Vault (`secret/prod/ai-microservice`). No token budget logic removed — kept for future re-activation.
- **How to apply:** Do this second. Unblocks reliable end-to-end testing.

### Item 3 — AWAITING_USER Status + GUI (runlayer)
- **GitHub:** https://github.com/speakASAP/runlayer/issues/18
- **Plan:** `runlayer/docs/superpowers/plans/2026-05-26-awaiting-user-status.md`
- **Status:** NOT STARTED
- **What:** Add `awaiting_user` task status + `pendingQuestion` column. Worker detects `__needs_user_input: true` in LLM response. Dashboard shows yellow "Needs Your Answer" panel. POST `/api/dashboard/tasks/:id/answer` resumes task.
- **DB migration required:** `pending_question TEXT NULL` on `runlayer.tasks`.
- **How to apply:** Do this last. Builds on stable Claude routing from Item 2.

### Architecture Notes (from exploration)
- runlayer at port 3390; ai-microservice at 3380
- Task statuses before this work: `created | assigned | in_progress | validation | done | failed | cancelled`
- After this work adds: `awaiting_user`
- Agent types: `global_coordinator` (smart, 5min), `project_coordinator` (cheap, 60min), `worker` (free, 10s dispatch), `validator` (free+cheap)
- After Item 2: ALL agent model tiers map to `claude-sonnet-4-6` regardless of tier name
- Worker pool in `src/worker/worker-pool.service.ts` dispatches every 10s via distributed Redis lease
- Dashboard WebSocket namespace: `/dashboard`, rooms: `global` + `project:{id}`
