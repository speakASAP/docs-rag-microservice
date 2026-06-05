# Command: prepare-pr

Prepare a pull request for the current branch.

## Steps

1. Run `.claude/checklists/before-pr.md` — all items must pass.
2. Run `npx tsc --noEmit` — zero errors required.
3. Run `npm test` — all tests must pass.
4. Run `/review-security` — no FAIL items allowed.
5. Run `/review-gdpr` — no blocking FAIL items allowed.
6. Run `/review-api-contracts` — no MISMATCH items allowed.
7. Collect git diff summary.
8. Draft PR description using this template:

```markdown
## Summary
- <bullet: what changed>
- <bullet: why>

## Scope
- Included: <list>
- Excluded: <list>

## Testing
- [ ] Unit tests: <N> tests covering <what>
- [ ] Integration tests: <what scenarios>
- [ ] Manual: <what was manually verified>

## Security
- [ ] Security review passed (no FAILs)
- [ ] No secrets in code or logs
- [ ] Auth/role checks in place

## GDPR
- [ ] GDPR review passed (no blocking FAILs)
- [ ] No unnecessary personal data collected

## Risks
- <known risk or "none">

## Docs updated
- [ ] If API contracts changed: docs/32 and docs/33 updated
- [ ] If domain model changed: docs/30 and docs/31 updated
```

9. Output the PR description to the terminal. Do not push without human confirmation.
