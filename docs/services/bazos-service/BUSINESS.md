# Business: bazos-service
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Bazos.cz classifieds automation: create/update ads, manage multiple accounts, handle ad renewal/expiration.

## Constraints

- Bazos has strict anti-spam rules — max 1 ad per 24h per account per category
- AI must never post duplicate ads
- Ad content must comply with Bazos category rules

## Consumers

flipflop-service.

## SLA

- Production: <https://bazos.alfares.cz>
- Events: subscribes to stock.updated
