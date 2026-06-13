# AGENTS.md

## Boundaries
- Ingestion agents: trigger via POST /ingestion/trigger (single repo) or POST /ingestion/trigger-all (all 35 repos)
- Retrieval agents: use POST /retrieval/agent-context (token-limited)
- Never query Git directly if this service is running

## Knowledge Retrieval (use before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`
- See: `docs/RAG_USAGE.md` for full usage guide

## Commands
- Build: npm run build
- Test: npm test
- Deploy: bash scripts/deploy.sh
- Trigger all ingestion: JWT_TOKEN=<token> bash scripts/trigger-all-ingestion.sh

## Intent Preservation System
- This repository follows the company standard in `/Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system`.
- Preserve the chain: Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation.
- Before implementation work, read the target task under `11_tasks/`, execution plan under `21_execution_plans/`, project invariants under `17_governance/PROJECT_INVARIANTS.md`, and applicable validation report under `12_validation/`.
- Do not edit `00_constitution/CONSTITUTION.md` or `01_vision/VISION.md` after adoption. Human intent changes go through `01_vision/VISION_EVOLUTION.md`.
- Declare sensitive-data, contract/schema, and replay/determinism impact in every task and execution plan.
- Do not place secrets, real JWTs, raw production data, confidential identifiers, or customer data into docs, prompts, tests, logs, reports, or examples.

## IPS Commands
- Documentation audit: `npm run docs:audit`
- Pre-coding gate: `npm run gate:pre-coding`
- Deployment readiness gate: `npm run gate:deployment -- --target TASK-001`

