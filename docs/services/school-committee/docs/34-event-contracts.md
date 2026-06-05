# Event Contracts

Events are optional for MVP but should be designed now.

## Event envelope

```json
{
  "eventId": "evt_123",
  "eventType": "task.created",
  "version": 1,
  "occurredAt": "2026-05-07T10:00:00Z",
  "tenantId": "tenant_001",
  "schoolId": "school_001",
  "actorUserId": "user_123",
  "correlationId": "req_123",
  "data": {}
}
```

## Events

### task.created

```json
{
  "taskId": "task_123",
  "title": "Buy mirror",
  "classId": null,
  "priority": "normal",
  "deadline": "2026-06-01"
}
```

### task.claimed

```json
{
  "taskId": "task_123",
  "assignedTo": "user_456"
}
```

### task.completed

```json
{
  "taskId": "task_123",
  "completedBy": "user_456",
  "proofFileIds": ["file_1"]
}
```

### payment.intent_created

```json
{
  "paymentIntentId": "pay_123",
  "userId": "user_123",
  "amountCzk": 200,
  "variableSymbol": "2605012345"
}
```

### payment.confirmed

```json
{
  "paymentIntentId": "pay_123",
  "amountCzk": 200,
  "source": "manual"
}
```

### feedback.submitted

```json
{
  "feedbackId": "fb_123",
  "category": "communication",
  "type": "suggestion",
  "classId": "class_1a",
  "anonymous": false
}
```

## Usage

Events can be used for:

- notifications
- audit
- analytics
- async workflows
- future integrations

## Data protection

Events must not contain full feedback text unless strictly necessary.

Prefer IDs and metadata.
