# Marketing Microservice API

## Endpoints

- `GET /health`
- `POST /segments`
- `GET /segments`
- `PUT /segments/:id`
- `DELETE /segments/:id`
- `POST /campaigns`
- `GET /campaigns`
- `PUT /campaigns/:id`
- `DELETE /campaigns/:id`
- `POST /campaigns/:id/execute` (requires `x-idempotency-key` header or `idempotencyKey` body)
- `GET /executions`

## Execution Rules

- Recipients are sent only via `NOTIFICATION_SERVICE_URL` at `/notifications/send`.
- Maximum chunk size is 30 recipients per outbound request.
- Marketing consent and unsubscribe checks run before each send attempt.
- Frequency cap is enforced per recipient per day.
- Execution is idempotent by `campaignId + idempotencyKey`.
