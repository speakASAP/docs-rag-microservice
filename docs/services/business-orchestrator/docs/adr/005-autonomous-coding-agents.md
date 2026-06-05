# ADR-005: Autonomous Coding Agents — Architecture Decision

**Status**: PROPOSED  
**Date**: 2026-05-04  
**Context**: Should we implement autonomous coding capabilities natively?

---

## Context

The current `CodingWorkerAgent` (ADR reference: `AGENT_REFERENCE.md`) handles `type: coding` tasks by:
1. Calling LiteLLM (`ai-microservice`) for planning
2. Writing files via `mcp-filesystem`
3. Running `deploy.sh` via `ShellExecService`
4. Validating via HTTP health check

This covers single-service patches well, but has gaps for **multi-file, multi-service, iterative coding tasks**.

---

## Decision: Implement Natively

We will enhance `CodingWorkerAgent` with native capabilities.

---

## Consequences

- `CodingWorkerAgent` remains the sole coding executor, enhanced per tasks in `docs/tasks/006-coding-agent-enhancements.md`
- No new external API keys or services required
- All LLM spend tracked within existing budget system

---

## Alternatives Considered

### A: Cursor SDK as sidecar service
Run a Node.js Cursor SDK sidecar that polls our task queue and executes coding tasks in Cursor cloud.

**Rejected because**: External API cost, model bypass, network isolation from our internal services.

### B: Cursor SDK for planning only, our executor for deployment
Use Cursor SDK to generate the coding plan/diff, then our deploy pipeline to apply it.

**Rejected because**: Adds external dependency for the easiest part (planning). Our LiteLLM already handles planning well.

### C: Implement full DAG coding pipeline natively (chosen path)
Enhance `CodingWorkerAgent` with DAG-style subtask decomposition, progress streaming, and revision loops.

**Selected**: Maximum control, no external dependencies, integrates with existing budget/retry/escalation system.
