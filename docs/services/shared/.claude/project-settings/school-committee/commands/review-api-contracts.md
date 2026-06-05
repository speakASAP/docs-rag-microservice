# Command: review-api-contracts

Verify that implementation matches documented API contracts.

## Steps

1. Read `docs/32-api-rest-contracts.md`.
2. Read `docs/33-openapi.yaml`.
3. Read `docs/14-auth-service-contract.md`.
4. Read `docs/15-db-service-contract.md`.
5. For each API call in changed files:
   - Verify endpoint path matches documented contract
   - Verify request payload matches schema
   - Verify response handling covers documented error codes
   - Verify required headers are sent (for DB service calls)
6. Check that no undocumented endpoints are called.
7. Check that error codes from `docs/35-error-model.md` are used correctly.

## Output format

```
API CONTRACT REVIEW — <date>

Contract: <endpoint>
  Implementation: <file>:<line>
  Status: MATCH / MISMATCH / UNDOCUMENTED
  Issue: <description if mismatch>

Summary: <N> match, <N> mismatch, <N> undocumented
Action required: yes/no
```
