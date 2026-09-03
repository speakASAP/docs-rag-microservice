# EP-TASK-001-bootstrap-service: Bootstrap docs-rag-microservice

status: validated
completeness_level: complete

## Upstream traceability

BUSINESS.md, SYSTEM.md, ../01_vision/VISION.md, ../11_tasks/TASK-001-bootstrap-service.md, ../22_goal_impact/GOAL-IMPACT-TASK-001.md, and ../12_validation/VAL-TASK-001-bootstrap-service.md define this plan.

## Scope

Complete the canonical IPS adoption documents and profile for the existing service using source and manifest evidence.

## Non-goals

No source code, schema, config, catalog, ingestion, deploy queue, Ollama, deployment, or infrastructure modification.

## Project invariants

Preserve DRAG-INV-001 through DRAG-INV-005: Git authority, JWT protection, catalog filtering, sensitive-data safety, and Git fallback.

## Sensitive-data handling

Use only sanitized architecture facts, variable names, paths, and route names. Never include tokens, secret values, raw production documents, or embeddings.

## Contract validation plan

Compare all required integration decisions with source, package metadata, .env.example, and k8s evidence. Validate the profile structure.

## Replay and determinism plan

No runtime behavior changes. Re-running validation on the unchanged document set produces the same result.

## Files to inspect

Root contracts, .env.example, package.json, app.module, embedding.service, repo-registry, qdrant service, logging service, service auth guard, health controller, and k8s manifests.

## Files to create

Canonical integration contract, bootstrap task, bootstrap execution plan, bootstrap validation report, and adoption profile.

## Files to modify

Root contracts, constitution, vision, project invariants, canonical goal impact, validation debt, tasks, and state.

## Files that must not be modified

Application source, k8s manifests, .env.example, deploy.config.sh, the shared repository catalog, the deploy queue, and Ollama configuration.

## Implementation steps

1. Read standards, repository contracts, configuration, manifests, and source evidence.
2. Run the non-destructive scaffold.
3. Complete required artifacts and integration decisions.
4. Run and resolve the planning validator.
5. Commit documentation only.

## Parallel execution

| Workstream | Status | Owner role | Allowed files | Dependencies | Validation | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| Documentation adoption | complete | worker | canonical adoption artifacts | approved existing intent | adoption validator | first and final |
| Catalog currency | dependency-gated | integration owner | future catalog task artifacts | service onboarding | catalog review | later |

## Blockers

No blocker prevents the documentation-only adoption task. Catalog currency remains a follow-up.

## Test plan

Run the planning adoption validator; no application test is necessary because no application code changed.

## Validation plan

Record the exact validator result in ../12_validation/VAL-TASK-001-bootstrap-service.md and distinguish no current validation debt.

## Gate commands

Run python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning.

## Documentation updates

Update all paths named by ips-adoption.json, including root contracts, governance, integration, bootstrap, state, and validation debt artifacts.

## Rollback plan

Revert only this documentation commit if a documented fact is found inaccurate; no runtime rollback is needed.

## Handoff

Project owner receives the committed validator-passing baseline and the catalog-currency follow-up.

## Completion checklist

Protected intent approval, profile completion, integration review, documentation completion, and validator evidence are complete. Deployment is not part of this documentation-only task.
