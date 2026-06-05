# Audit Log Model

## Purpose

Audit logs provide accountability for:

- role changes
- payment confirmation
- expense publication
- task verification
- feedback moderation
- consent actions
- account deletion requests

## Required fields

```json
{
  "id": "audit_123",
  "tenantId": "tenant_001",
  "schoolId": "school_001",
  "actorUserId": "user_123",
  "action": "payment.mark_paid",
  "entityType": "payment_intent",
  "entityId": "pay_123",
  "metadata": {
    "amountCzk": 200,
    "source": "manual"
  },
  "requestId": "req_123",
  "createdAt": "2026-05-07T10:00:00Z"
}
```

## Actions

### User and role

- user.profile_created
- user.profile_updated
- user.role_assigned
- user.role_revoked
- user.account_deletion_requested

### Payments

- payment.intent_created
- payment.mark_paid
- payment.corrected
- payment.cancelled

### Expenses

- expense.created
- expense.updated
- expense.published
- expense.hidden
- expense.deleted

### Tasks

- task.created
- task.claimed
- task.completed
- task.verified
- task.cancelled

### Feedback

- feedback.submitted
- feedback.moderated
- feedback.assigned
- feedback.resolved
- feedback.rejected

### Consent

- consent.accepted
- consent.revoked
- privacy.export_requested

## Rules

- audit logs are append-only
- no raw passwords
- no full sensitive text unless needed
- metadata must be minimized
- admin can view logs
- logs have retention policy
