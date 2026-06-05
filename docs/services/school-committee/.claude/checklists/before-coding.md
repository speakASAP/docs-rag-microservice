# Checklist: Before Coding

Run before starting any implementation task. Stop if any item cannot be confirmed.

## Documentation

- [ ] Task file read fully (`.claude/tasks/<id>-*.md`)
- [ ] All referenced docs in task file read
- [ ] No open product decision blocks the task
- [ ] TASKS.md checked — no unresolved blocking dependencies

## Architecture alignment

- [ ] Task does not implement auth internally (→ use auth-microservice)
- [ ] Task does not write directly to PostgreSQL (→ use DB service API)
- [ ] Task does not include production secrets in any file
- [ ] Task does not create child accounts (MVP constraint)
- [ ] Task does not add Stripe or card payment processing (MVP constraint)

## Environment

- [ ] `.env.example` has all required keys for new env vars
- [ ] Any new secret is added to Vault path plan in `docs/19-vault-secrets.md`
- [ ] Any new ConfigMap key is non-sensitive

## Contracts

- [ ] Any new API endpoint is consistent with `docs/32-api-rest-contracts.md`
- [ ] Any new domain field is consistent with `docs/30-domain-model.md` and `docs/31-erd-database-schema.md`

## Ready signal

All items checked → proceed to implementation.
Any item blocked → stop, report issue, wait for human input.
