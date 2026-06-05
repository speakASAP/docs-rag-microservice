# DB Service Contract

## Ownership

The DB microservice owns persistence.

The platform BFF must not bypass it unless explicitly allowed.

## General API conventions

Base URL:

```text
DB_SERVICE_BASE_URL/api/v1
```

Headers:

```http
Authorization: Bearer <service-token>
X-Request-Id: <uuid>
X-Actor-User-Id: <uuid>
X-Actor-Role: <role>
X-Tenant-Id: <uuid>
X-School-Id: <uuid>
```

## Required capabilities

- profiles CRUD
- classes list
- contribution plans list
- payments create/update/list
- tasks CRUD and atomic claim
- feedback create/moderate/list
- expenses CRUD
- public reports query
- audit log write
- CSV export queries

## Atomic operations

The DB service must expose atomic endpoints for:

- claim task
- mark payment paid
- register for event with capacity limit
- vote once per idea
- create audit log with mutation if transaction boundary is available

## Example: atomic task claim

```http
POST /tasks/{taskId}/claim
```

Request:

```json
{
  "assigneeUserId": "user_123"
}
```

Response:

```json
{
  "id": "task_123",
  "status": "reserved",
  "assignedTo": "user_123",
  "updatedAt": "2026-05-07T10:00:00Z"
}
```

Conflict response:

```json
{
  "error": {
    "code": "TASK_ALREADY_CLAIMED",
    "message": "Task is already claimed"
  }
}
```

## Data validation

DB service should enforce:

- required fields
- enum values
- immutable payment records after paid
- one active claim per task
- no duplicate vote
- no negative expenses
- tenant isolation

## Search and filtering

Task list filters:

- status
- class_id
- participation_type recommendation
- due_before
- priority

Feedback filters:

- status
- category
- class_id
- anonymous
- assigned_to

Payments filters:

- status
- user_id
- date range
- variable_symbol

## Pagination

All list endpoints must support:

```text
limit
cursor
sort
direction
```

## Required DB service endpoints

See `32-api-rest-contracts.md` and `33-openapi.yaml`.
