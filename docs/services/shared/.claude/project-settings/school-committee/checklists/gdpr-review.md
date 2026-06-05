# Checklist: GDPR Review

Source: `docs/41-gdpr-and-data-protection.md`, `docs/42-child-safety-and-moderation.md`

## Data minimization

- [ ] No field collected without clear purpose
- [ ] Child data: only class association, display label, birth year (no full name, no exact birth date)
- [ ] No health, behavioral, or sensitive child data
- [ ] Phone number is optional, not required
- [ ] Bank payer details not stored from bank statements

## Consent

- [ ] Consent recorded before any data collection starts
- [ ] Consent stored with: type, version, timestamp, user_id, source
- [ ] Required consents: terms, privacy policy, committee participation
- [ ] Consent can be reviewed and revoked by user

## Public exposure

- [ ] Individual parent payment amounts NOT in public report
- [ ] Individual payer names NOT in public report
- [ ] Anonymous feedback: author ID not exposed in API response
- [ ] Child names not in any public-facing list

## Data subject rights (MVP manual process)

- [ ] Account deletion request flow exists
- [ ] Deletion anonymizes profile (name, email) — does not delete audit skeleton
- [ ] Admin can manually process deletion requests

## Event payloads and logs

- [ ] Audit log entries do not include full PII (use user_id reference, not name/email)
- [ ] Log fields do not include payment amounts or personal details unnecessarily
- [ ] Event payloads carry minimal identifying info

## Retention

- [ ] Feedback older than 24 months: process defined (even if manual MVP)
- [ ] Task photos: deletion plan defined when task archived

## Child safety

- [ ] No child accounts created (MVP constraint)
- [ ] Ideas submitted by parents on behalf of children only
- [ ] No child-to-child communication
- [ ] No public child profiles

## Transparency

- [ ] Privacy policy page exists (or planned)
- [ ] Terms page exists (or planned)
- [ ] Consent version tracked so policy updates can be re-requested
