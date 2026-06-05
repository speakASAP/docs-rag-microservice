# Business: heureka-service
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Heureka.cz/sk XML feed generation from catalog products. Auto-regenerates on stock updates.

## Constraints

- Feed must always be valid XML per Heureka schema
- AI must never include products with zero stock in feed
- Feed generation must complete within 60 seconds

## Consumers

flipflop-service (feed submission to Heureka).

## SLA

- Production: <https://heureka.alfares.cz>
- Events: subscribes to stock.updated
