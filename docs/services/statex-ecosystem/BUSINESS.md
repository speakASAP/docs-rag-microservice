# Business: statex-ecosystem

> IMMUTABLE BY AI.

## Goal

Public **Next.js catalog** of Statex applications and microservices with curated outbound links. Supports discovery of the ecosystem; deployed blue/green like other static/catalog sites.

## Constraints

- Content must stay accurate vs [shared/README.md](../shared/README.md) and [shared/ECOSYSTEM_MAP.md](../shared/ECOSYSTEM_MAP.md).
- No secrets in repo; use `.env` per [shared/docs/ENV_FILE_STANDARD.md](../shared/docs/ENV_FILE_STANDARD.md).

## Consumers

Visitors, internal stakeholders, and agents mapping the ecosystem.

## SLA

- Production: <https://statex-ecosystem.alfares.cz>
- Ports: **4710** (blue) / **4711** (green); health: `/api/health`
