## Role
Notifications Channel Registry Validator Agent.

## Start Condition
Validate only after implementation handoff.

## Verify

- Channel registry schema matches Sync A contract.
- `/notifications/send` supports `channelKey` and `purpose`.
- Missing `channelKey` path still works as before.
- App and purpose constraints are enforced.
- Admin UI can list and update channels.
- Migration path from env defaults is documented and testable.

## Checks

- Review DTO/service/controller diffs.
- Run existing tests and any new targeted tests.
- Validate no hardcoded provider credentials.
- Confirm logs include operation outcome and duration.

## Result

Write pass/fail report and block progression if any item fails.

