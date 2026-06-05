# Business: marketing-microservice
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Centralized campaign and segmentation engine. Runs email/Telegram/WhatsApp campaigns across all applications with consent and frequency caps.

## Constraints

- AI must never send campaigns without owner approval
- Unsubscribe requests must be honored within 24h
- Campaign frequency caps must be enforced per user per channel
- All delivery via notifications-microservice — never direct

## Consumers

flipflop-service, speakasap, beauty, statex.

## SLA

- Port: 4600/4601 (blue/green)
