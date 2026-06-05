# REST API Contracts

All frontend-facing endpoints are exposed by the BFF.

## Common headers

```http
Authorization: Bearer <access_token>
X-Request-Id: <uuid>
Accept-Language: cs
```

## Common response envelope

Success:

```json
{
  "data": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "fields": {},
    "requestId": "req_123"
  }
}
```

## Auth

Auth is delegated. BFF only exposes helper endpoints if needed.

```http
GET /api/me
```

Response:

```json
{
  "data": {
    "userId": "user_123",
    "email": "parent@example.com",
    "roles": ["parent"],
    "profileComplete": true
  }
}
```

## Onboarding

```http
POST /api/onboarding/complete
```

Request:

```json
{
  "firstName": "Jan",
  "lastName": "Novak",
  "phone": "+420777111222",
  "language": "cs",
  "classId": "class_1a",
  "childrenCount": 1,
  "participationType": "mixed",
  "gdprConsent": true
}
```

Response:

```json
{
  "data": {
    "profileComplete": true
  }
}
```

## Classes

```http
GET /api/classes
```

Response:

```json
{
  "data": [
    {
      "id": "class_1a",
      "name": "1.A",
      "schoolYear": "2026/2027"
    }
  ]
}
```

## Tasks

### List tasks

```http
GET /api/tasks?status=open&classId=class_1a
```

Response:

```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Paint classroom radiators",
      "description": "Help repaint radiators in class 1.A",
      "priority": "normal",
      "deadline": "2026-06-01",
      "status": "open",
      "classId": "class_1a"
    }
  ]
}
```

### Create task

```http
POST /api/tasks
```

Request:

```json
{
  "title": "Buy mirror for toilet",
  "description": "Small mirror for children bathroom",
  "classId": null,
  "deadline": "2026-06-01",
  "priority": "normal",
  "photoFileId": "file_123"
}
```

Required role:

- committee
- teacher
- school_staff
- admin

### Claim task

```http
POST /api/tasks/{taskId}/claim
```

Response:

```json
{
  "data": {
    "id": "task_123",
    "status": "reserved",
    "assignedTo": "user_123"
  }
}
```

### Complete task

```http
POST /api/tasks/{taskId}/complete
```

Request:

```json
{
  "comment": "Task finished",
  "proofFileIds": ["file_456"]
}
```

### Verify task

```http
POST /api/tasks/{taskId}/verify
```

Required role:

- committee
- teacher
- school_staff
- admin

## Contributions

### List plans

```http
GET /api/contributions/plans
```

### Create QR payment

```http
POST /api/payments/qr
```

Request:

```json
{
  "planId": "plan_monthly_200",
  "amountCzk": 200
}
```

Response:

```json
{
  "data": {
    "paymentIntentId": "pay_123",
    "amountCzk": 200,
    "currency": "CZK",
    "variableSymbol": "2605012345",
    "qrPayload": "SPD*1.0*ACC:CZ...",
    "qrImageUrl": "/api/payments/pay_123/qr-image",
    "status": "pending"
  }
}
```

### My payment history

```http
GET /api/payments/my
```

## Admin payments

### Mark paid manually

```http
POST /api/admin/payments/{paymentIntentId}/mark-paid
```

Request:

```json
{
  "paidAt": "2026-05-07T10:00:00Z",
  "amountCzk": 200,
  "reference": "Bank statement line 123",
  "reason": "Manual reconciliation from bank account"
}
```

## Feedback

### Submit feedback

```http
POST /api/feedback
```

Request:

```json
{
  "category": "communication",
  "type": "suggestion",
  "classId": "class_1a",
  "isAnonymous": false,
  "text": "It would help to have clearer event reminders."
}
```

### Admin feedback list

```http
GET /api/admin/feedback?status=new
```

### Update feedback status

```http
PATCH /api/admin/feedback/{feedbackId}
```

Request:

```json
{
  "status": "in_review",
  "assignedTo": "user_teacher_123"
}
```

## Reports

### Public finance report

```http
GET /api/reports/public/finance
```

Response:

```json
{
  "data": {
    "totalCollectedCzk": 25000,
    "totalSpentCzk": 12000,
    "balanceCzk": 13000,
    "expenses": [
      {
        "title": "Sports equipment",
        "amountCzk": 3000,
        "category": "equipment",
        "spentAt": "2026-04-15"
      }
    ]
  }
}
```

## Admin exports

```http
GET /api/admin/export/payments.csv
GET /api/admin/export/tasks.csv
GET /api/admin/export/feedback.csv
```
