# Spec: heureka-service
> Human-managed. Agents must not edit.

## Requirements

- Generate valid XML feeds per Heureka.cz/sk schema from catalog data
- Exclude products with zero stock
- Feed generation < 60 s for full catalog
- Feed is public — no internal cost/margin data
- Auto-regenerate on `stock.updated` event from warehouse-microservice

## Acceptance criteria

- `GET /api/feed` returns well-formed XML validated against Heureka schema
- Zero-stock products absent from every generated feed
- Generation latency ≤ 60 s under production load
- ESO syncs secrets from Vault within 5 min of rotation

## Out of scope

- Order processing, payments, catalog mutations
- Feed submission (owned by flipflop-service)

→ Active goals: [GOALS.md](GOALS.md) | Execution plan: [PLAN.md](PLAN.md)
