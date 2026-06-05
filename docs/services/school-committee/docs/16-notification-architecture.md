# Notification Architecture

## MVP channels

- email

## Future channels

- web push
- mobile push through PWA
- digest notifications
- calendar reminders

## Notification events

- task_created
- task_claimed
- task_completed
- task_verified
- feedback_submitted
- feedback_status_changed
- payment_pending
- payment_confirmed
- event_created
- event_reminder

## Notification service contract

```http
POST /notifications/send
```

Request:

```json
{
  "type": "task_created",
  "recipientUserIds": ["user_123"],
  "template": "task-created",
  "locale": "cs",
  "data": {
    "taskTitle": "Paint classroom radiators",
    "deadline": "2026-06-01"
  }
}
```

## Email templates

Required MVP templates:

- welcome
- onboarding incomplete
- task created
- task claimed confirmation
- task verified
- feedback received
- feedback status changed
- payment instructions
- payment confirmed

## Digest strategy

Avoid notification spam.

For non-urgent events:

- daily digest
- weekly committee report

## Privacy

Emails must not expose:

- child full names
- sensitive feedback text
- anonymous feedback author
- unpaid parent lists

## Failure handling

If notification fails:

- log failure
- retry with backoff
- do not fail critical domain mutation unless notification is legally required
