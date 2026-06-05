# User Flows

## Flow 1: Parent registration

### Trigger

Parent scans QR code or opens registration link.

### Steps

1. User opens landing page.
2. User selects language.
3. User clicks `Register`.
4. Frontend redirects to external auth service or opens embedded registration form depending on auth integration mode.
5. User verifies email.
6. User returns to onboarding.
7. User fills:
   - first name
   - last name
   - phone optional
   - class of child
   - number of children
   - participation type
   - GDPR consent
8. System creates parent profile through DB service.
9. User lands on dashboard.

### Acceptance criteria

- user cannot access dashboard without verified account
- user cannot complete onboarding without GDPR consent
- class selection is required
- language persists
- audit event is created

## Flow 2: Parent chooses financial participation

### Steps

1. Parent opens dashboard.
2. Parent sees contribution card.
3. Parent selects contribution plan.
4. System generates QR payment.
5. Parent scans QR in banking app.
6. Payment remains pending until manual/automatic reconciliation.
7. Parent sees status.

### Acceptance criteria

- QR contains amount, bank account, variable symbol and message
- payment record is immutable after paid
- parent can see own history
- public page shows only aggregated amount

## Flow 3: Parent chooses labor participation

### Steps

1. Parent selects `help with time/work`.
2. Dashboard shows recommended tasks.
3. Parent opens task detail.
4. Parent clicks `Claim task`.
5. System assigns task to parent and blocks it for others.
6. Parent completes task and uploads proof.
7. Committee verifies.
8. Public task status changes to completed.

### Acceptance criteria

- only one active assignee per task
- task claim is atomic
- status changes are logged
- proof files are private unless explicitly published

## Flow 4: Feedback submission

### Steps

1. Parent opens feedback QR link.
2. Selects category.
3. Selects class.
4. Selects type:
   - idea
   - complaint
   - suggestion
   - thanks
5. Chooses anonymous or named.
6. Writes text.
7. Submits.
8. Feedback enters moderation queue.
9. Responsible person receives notification.
10. Status changes are visible if named feedback.

### Acceptance criteria

- anonymous feedback stores no public name
- internal audit still tracks submission if required by policy
- feedback cannot be publicly visible without moderation
- abusive content can be rejected

## Flow 5: Committee creates expense

### Steps

1. Committee opens admin panel.
2. Creates expense record.
3. Enters title, category, amount, date.
4. Uploads receipt if available.
5. Expense appears in public report after publish flag is enabled.

### Acceptance criteria

- expense amount cannot be negative
- receipt is private by default
- public report does not expose personal data
- audit event is created

## Flow 6: School creates task

### Steps

1. Teacher or school staff opens admin/staff panel.
2. Creates task.
3. Adds title, description, deadline, photo, priority.
4. Selects class or school-wide.
5. Publishes task.
6. Parents with labor/mixed participation are notified.

### Acceptance criteria

- only authorized staff can create task
- task must have title, description, deadline
- published task appears in task list
- notification event is emitted

## Flow 7: Admin assigns role

### Steps

1. Admin opens user management.
2. Searches user.
3. Assigns role.
4. System records role change in audit log.
5. User receives updated permissions on next token refresh or permission reload.

### Acceptance criteria

- admin cannot remove last admin
- role change is auditable
- role escalation requires explicit confirmation
