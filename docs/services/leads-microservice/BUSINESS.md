# Business: leads-microservice
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Lead intake and follow-up without requiring registration. Collects contact submissions and integrates with CRM + AI analysis.

## Constraints

- GDPR: lead data requires consent tracking
- AI must never export raw lead data without explicit approval
- No mass outreach without human review

## Consumers

sgiprealestate, statex, marketing-microservice.

## SLA

- Port: 4400/4401 (blue/green)
- Production: <https://leads.alfares.cz>
