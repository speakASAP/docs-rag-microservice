## Role
Documentation and Cutover Readiness Validator Agent.

## Scope
Validate TG-2.2 documentation and cutover readiness artifacts.

## Inputs

- TG-2.2 implementation output
- Updated docs across affected services
- `docs/agents/contracts/phase-2-cutover-checklist.md`
- Existing phase-1 contracts/evidence for reference

## Validation Steps

1. Verify required docs were updated and are consistent with contracts.
2. Verify flipflop documentation clearly states AWS SES as target email identity.
3. Verify no references remain that imply unsupported legacy sending path.
4. Validate cutover checklist quality:
   - pre-deploy, rollout, rollback, post-deploy sections exist
   - each checklist item is testable
5. Verify docs contain no secrets.

## Approval Checklist

- [ ] Cross-service docs match implemented contracts.
- [ ] Flipflop SES migration messaging is complete and unambiguous.
- [ ] Cutover checklist is complete and operationally usable.
- [ ] No secret leakage in any updated doc.

## Decision Output

- Create/update `docs/agents/contracts/phase-2-docs-cutover-validation-report.md`
- Format:
  - `decision: APPROVED|REJECTED`
  - checklist table with evidence pointers
  - blocking and non-blocking issues
