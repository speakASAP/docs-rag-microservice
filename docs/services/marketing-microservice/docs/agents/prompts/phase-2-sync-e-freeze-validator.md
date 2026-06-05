## Role
Sync E Freeze Validator Agent.

## Scope
Approve or reject Sync E final freeze based on TG-2.1 and TG-2.2 validated outputs.

## Inputs

- `docs/agents/contracts/phase-2-sync-e-freeze-candidate.md`
- `docs/agents/contracts/phase-2-observability-validation-report.md`
- `docs/agents/contracts/phase-2-docs-cutover-validation-report.md`
- `docs/agents/contracts/phase-2-cutover-checklist.md`

## Validation Steps

1. Confirm both prerequisite validation reports are APPROVED.
2. Verify freeze candidate includes evidence-linked pass/fail matrix.
3. Verify unresolved risks are explicit with owner and mitigation path.
4. Verify go/no-go recommendation is justified and operationally actionable.

## Approval Checklist

- [ ] TG-2.1 approved.
- [ ] TG-2.2 approved.
- [ ] Sync E candidate contains complete evidence map.
- [ ] Remaining risks are documented with owners.
- [ ] Decision can be executed by operators without ambiguity.

## Decision Output

- Create/update `docs/agents/contracts/phase-2-sync-e-validation-report.md`
- Format:
  - `decision: APPROVED|REJECTED`
  - checklist table with evidence pointers
  - blocking and non-blocking issues
  - final recommendation
