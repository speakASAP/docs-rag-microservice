# Checklist: Before PR

Run before opening a pull request. All items must pass.

## Code quality

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `npm test` — all tests pass
- [ ] No `console.log` left in production code (use structured logger)
- [ ] No commented-out code blocks
- [ ] No `TODO` comments without a linked task ID

## Security

- [ ] No secrets in any committed file
- [ ] No tokens stored in localStorage or sessionStorage
- [ ] All API routes validate auth token server-side
- [ ] All mutations check role before proceeding
- [ ] All mutations emit audit event
- [ ] All inputs validated with Zod schemas
- [ ] No internal service URLs or tokens in client-side bundles

## GDPR

- [ ] No unnecessary personal data collected
- [ ] No child full names, exact birth dates, or photos stored
- [ ] Individual payment status not publicly exposed
- [ ] Anonymous feedback author not exposed

## API contracts

- [ ] All new/changed endpoints match `docs/32-api-rest-contracts.md`
- [ ] If contracts changed, docs/32 and docs/33 updated
- [ ] DB service calls include all required headers (X-User-Id, X-Actor-Role, X-Tenant-Id, X-School-Id, X-Request-Id)

## Observability

- [ ] All requests carry `request_id`
- [ ] Structured logging in place for new routes
- [ ] Errors use normalized error codes from `docs/35-error-model.md`

## Tests

- [ ] Unit tests for new validation schemas
- [ ] Permission test: unauthorized user blocked
- [ ] At least one happy-path integration test per new feature

## Docs

- [ ] If domain model changed: docs/30 and docs/31 updated
- [ ] If new env var added: .env.example updated, SYSTEM.md updated
- [ ] STATE.json updated with completed task
