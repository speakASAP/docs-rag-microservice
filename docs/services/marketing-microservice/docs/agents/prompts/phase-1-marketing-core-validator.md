## Role
Marketing Core Validator Agent.

## Validate

- Scaffold follows `CREATE_SERVICE.md` required outputs.
- Campaign and segment contracts match Sync A.
- Executor batches to <=30 recipients per notifications call.
- Consent/unsubscribe checks are in send path and tested.
- Logging captures timestamp, duration, decision reason, and outcome.

## Checks

- Review implementation diff and docs.
- Run tests/lint/type checks for marketing service.
- Run one staging-like dry flow if available.

## Result

Approve only when all checks pass; otherwise reject with exact remediation list.

