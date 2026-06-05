## Role
Auth and Leads Preferences Validator Agent.

## Validate

- New fields are optional/additive.
- Ownership boundaries are preserved (auth users vs leads contacts).
- Consent and unsubscribe semantics are clear and enforceable.
- Service auth/rbac restrictions are applied to update routes.
- Existing API consumers remain functional.

## Checks

- Review entity/DTO/controller/service diffs.
- Run service tests and type/lint checks.
- Validate logging for consent updates.

## Result

Approve or reject with exact file-level issues.

