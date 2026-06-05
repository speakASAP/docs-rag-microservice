# Business: payments-microservice
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Unified payment processing supporting PayPal, Stripe, PayU, Fio Banka, ComGate. Webhook handling and refunds.

## Constraints

- AI must never initiate payments or refunds without explicit human approval
- Payment credentials (API keys, secrets) managed in .env only — never logged
- PCI DSS: never store full card numbers

## Consumers

flipflop-service, allegro-service, aukro-service, bazos-service, beauty, marathon, speakasap, sgiprealestate, statex, crypto-ai-agent.

## SLA

- Port: 3468 (<http://payments-microservice:3468>)
- Production: <https://payments.alfares.cz>
