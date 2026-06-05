# Command: review-gdpr

Run a GDPR compliance review on changed files or a feature.

## Steps

1. Read `docs/41-gdpr-and-data-protection.md`.
2. Read `docs/42-child-safety-and-moderation.md`.
3. Read `.claude/checklists/gdpr-review.md`.
4. Check changed files against every item.
5. Produce report.

## Focus areas

- Data minimization: are unnecessary fields being collected?
- Child data: are full names, exact birth dates, or photos of children stored?
- Consent: is consent recorded before data collection?
- Payment data: are payer personal details stored unnecessarily?
- Public exposure: is individual payment status visible publicly?
- Anonymous feedback: is author identity protected?
- Retention: is data kept longer than needed?
- Deletion: does the deletion flow anonymize properly?
- Event payloads: do events carry unnecessary personal data?

## Output format

```
GDPR REVIEW — <date>
Feature/files: <scope>

PASS: <item>
FAIL: <item> — <description> — must fix before merge
WARN: <item> — <description> — needs legal review

Summary: <N> pass, <N> fail, <N> warn
Blocking: yes/no
```
