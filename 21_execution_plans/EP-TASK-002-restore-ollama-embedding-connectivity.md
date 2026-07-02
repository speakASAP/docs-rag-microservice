# EP-TASK-002 Restore Ollama Embedding Connectivity

```yaml
id: EP-TASK-002
status: validating
owner: platform-engineering
source_task: ../11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
vision: 01_vision/VISION.md
constitution: 00_constitution/CONSTITUTION.md
feature: 10_features/FEAT-001-documentation-ingestion.md
goal_impact: 22_goal_impact/GOAL-IMPACT-TASK-002.md
upstream:
  - 11_tasks/TASK-002-restore-ollama-embedding-connectivity.md
  - 22_goal_impact/GOAL-IMPACT-TASK-002.md
```

## Metadata

Task: `TASK-002`. Date: 2026-07-02. Change type: operational configuration
repair.

## Upstream Traceability

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding
Prompt -> Code -> Validation.

## Goal Impact

Restores embedding connectivity required for Docs/RAG ingestion and retrieval
freshness. This unblocks Cliplot GOAL-06 Docs/RAG preflight without weakening
auth or introducing live commerce mutations.

## Scope

Update Docs/RAG runtime configuration and evidence for the active Docker Ollama
host port.

## Non-Goals

No API changes, no schema migrations, no secret changes, no unauthenticated
retrieval or ingestion, and no automatic ingestion trigger before preflight
passes.

## Files to Inspect

- `k8s/configmap.yaml`
- `SYSTEM.md`
- `STATE.json`
- `src/ingestion/embedding.service.ts`
- `scripts/deploy.sh`

## Files to Create

- `11_tasks/TASK-002-restore-ollama-embedding-connectivity.md`
- `21_execution_plans/EP-TASK-002-restore-ollama-embedding-connectivity.md`
- `22_goal_impact/GOAL-IMPACT-TASK-002.md`
- `12_validation/VAL-TASK-002-restore-ollama-embedding-connectivity.md`

## Files to Modify

- `k8s/configmap.yaml`
- `SYSTEM.md`
- `STATE.json`

## Files That Must Not Be Modified

- `00_constitution/CONSTITUTION.md`
- `01_vision/VISION.md`
- Vault secret values
- API controllers and DTOs unless a separate approved task exists

## Implementation Steps

1. Verify active Ollama endpoint and model availability.
2. Pull `nomic-embed-text` into the existing Ollama runtime if absent.
3. Change `OLLAMA_URL` to `http://192.168.88.53:11435`.
4. Deploy Docs/RAG through `scripts/deploy.sh`.
5. Verify embedding shape and Cliplot Docs/RAG preflight.

## Test Plan

- `npm run build`
- `npm test`
- `npm run docs:audit`
- `npm run gate:pre-coding`
- `npm run gate:deployment -- --target TASK-002`

## Validation Plan

- Verify the Ollama tags endpoint includes `nomic-embed-text`.
- Verify the Ollama embeddings endpoint returns length `768` from inside the Docs/RAG pod.
- Verify deployment rollout and `/health`.
- Verify Cliplot Docs/RAG preflight returns pass.
- Verify Cliplot readiness bundle no longer blocks on Docs/RAG preflight.

## Documentation Updates

Update `SYSTEM.md`, `STATE.json`, and `VAL-TASK-002` with the final evidence.

## Rollback Plan

Revert `k8s/configmap.yaml` to the previous `OLLAMA_URL`, deploy Docs/RAG, and
record that Cliplot Docs/RAG preflight is blocked again by embedding reachability.

## Agent Handoff Prompt

Repair Docs/RAG embedding connectivity by aligning `OLLAMA_URL` with the live
Docker Ollama host port. Preserve JWT auth, avoid secret output, and validate
from the Docs/RAG pod and Cliplot readiness scripts.

## Completion Checklist

- [x] Active Ollama endpoint identified.
- [x] Embedding model available.
- [x] Config updated.
- [ ] Deployment complete.
- [ ] Cliplot preflight passes.
- [ ] Validation report finalized.
