# Risks and Architecture Decisions

## Key risks

### RISK-001 Legal ownership of funds

Problem:
Money cannot safely sit on a personal parent account.

Mitigation:
Use spolek-owned bank account.

### RISK-002 GDPR exposure through transparent account

Problem:
Transparent account may expose payer data.

Mitigation:
Use normal account plus public aggregated reports.

### RISK-003 Low parent registration

Problem:
School cannot provide parent data.

Mitigation:
QR onboarding, simple mobile UX, school distributes link voluntarily.

### RISK-004 Committee overload

Problem:
Manual reconciliation and moderation may create work.

Mitigation:
Start simple, add CSV import and automation in Phase 2.

### RISK-005 Overbuilt MVP

Problem:
Too many modules delay launch.

Mitigation:
MVP excludes child accounts, speech-to-text, advanced calendar.

### RISK-006 Payment disputes

Problem:
Parent claims payment not recorded.

Mitigation:
variable symbol, bank statement reference, audit log.

### RISK-007 Task liability

Problem:
Some tasks may require professional work.

Mitigation:
task categories, disclaimers, school approval, no dangerous work without authorization.

## Architecture decisions

### ADR-001 Use external auth service

Decision:
Do not implement auth internally.

Reason:
Existing auth microservice already exists.

### ADR-002 Use external DB service

Decision:
All persistence goes through DB microservice.

Reason:
Infrastructure already owns databases.

### ADR-003 Use Vault

Decision:
All secrets come from Vault.

Reason:
Existing secure secret management.

### ADR-004 Use QR payments for MVP

Decision:
Use Czech QR bank payments instead of Stripe.

Reason:
Better local fit and lower complexity.

### ADR-005 Avoid child accounts in MVP

Decision:
Child ideas are parent-submitted in MVP.

Reason:
Reduce child-data and moderation risk.

### ADR-006 Keep all docs in /docs

Decision:
All documentation stays in one folder.

Reason:
Easier for agents and humans to navigate.
