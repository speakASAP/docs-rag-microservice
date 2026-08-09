# Business: shared (ecosystem hub)

> IMMUTABLE BY AI.

## Goal

Single place for **cross-cutting documentation**, **standards**, and **scripts** so every Statex app/microservice stays aligned (deploy, env, logging, agent docs).

## Constraints

- No application runtime in this repo — docs and tooling only.
- Secrets never in markdown; they live in Vault at `secret/prod/<service>`.

## Consumers

All sibling repositories under the workspace root; humans and AI agents.

## SLA

- **Docs** stay consistent with production paths in [README.md](README.md).
- **Agent doc standard**: [docs/PROJECT_AGENT_DOCS_STANDARD.md](docs/PROJECT_AGENT_DOCS_STANDARD.md).
