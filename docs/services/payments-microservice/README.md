# Payment Microservice

Centralized payment service for the Statex microservices ecosystem. Handles payment processing via multiple payment providers including PayPal, Stripe, PayU, Fio Banka, and ComGate.

## Features

- ✅ **Multiple Payment Methods** - PayPal, Stripe, PayU, Fio Banka, ComGate, and generic card payments
- ✅ **Unified API** - Single API for all payment methods
- ✅ **Webhook Support** - Automatic payment status updates via webhooks
- ✅ **Refund Support** - Full and partial refunds
- ✅ **Secure** - API key authentication and webhook signature verification
- ✅ **Database Integration** - PostgreSQL storage for payment records
- ✅ **Comprehensive Logging** - Centralized logging via external logging microservice
- ✅ **Transaction History** - Complete audit trail of all payment transactions

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (via shared database-server)
- **ORM**: TypeORM
- **Payment Providers**: PayPal, Stripe, PayU, Fio Banka, ComGate
- **Logging**: External centralized logging microservice with local fallback

## API Endpoints

### Payment Endpoints

#### POST /payments/create

Create a new payment request.

**Headers:**

- `X-API-Key: <your-api-key>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "orderId": "string",
  "applicationId": "string",
  "amount": 1000.00,
  "currency": "CZK",
  "paymentMethod": "payu|stripe|paypal|fiobanka|comgate|card",
  "callbackUrl": "https://app.alfares.cz/api/payments/callback",
  "successUrl": "https://app.alfares.cz/payment-result?status=completed",
  "cancelUrl": "https://app.alfares.cz/payment-result?status=cancelled",
  "customer": {
    "email": "customer@example.com",
    "name": "John Doe",
    "phone": "+420123456789"
  },
  "metadata": {}
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "status": "pending",
    "redirectUrl": "https://payu.cz/...",
    "expiresAt": "2025-01-01T12:00:00Z"
  }
}
```

For Stripe Checkout, `POST /payments/create` typically returns `status: "processing"` with a Checkout redirect URL. Final status (`completed` or `failed`) is applied asynchronously by Stripe webhooks (`checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.expired`).

#### GET /payments/:paymentId

Get payment status.

**Headers:**

- `X-API-Key: <your-api-key>`

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "orderId": "string",
    "status": "completed",
    "amount": 1000.00,
    "currency": "CZK",
    "paymentMethod": "payu",
    "providerTransactionId": "string",
    "createdAt": "2025-01-01T10:00:00Z",
    "completedAt": "2025-01-01T10:05:00Z"
  }
}
```

Stripe note: payment reconciliation supports both Checkout Session IDs (`cs_...`) and Payment Intent IDs (`pi_...`) from webhook events, with `orderId` fallback for open Stripe payments.

#### POST /payments/:paymentId/refund

Refund a payment (full or partial).

**Headers:**

- `X-API-Key: <your-api-key>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "amount": 500.00,
  "reason": "Customer request"
}
```

### Stripe Connect Endpoints

#### POST /stripe/connect/accounts

Create a Stripe connected account and persist the Stripe account ID mapping to your domain user.

**Headers:**

- `X-API-Key: <your-api-key>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "applicationId": "flipflop-service",
  "connectedUserId": "merchant-123",
  "country": "US",
  "accountName": "Merchant 123",
  "metadata": {
    "tenantId": "tenant-1"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "applicationId": "flipflop-service",
    "connectedUserId": "merchant-123",
    "stripeAccountId": "acct_123",
    "stripeAccountStatus": "pending",
    "country": "US",
    "createdAt": "2026-04-15T10:00:00.000Z",
    "updatedAt": "2026-04-15T10:00:00.000Z"
  }
}
```

#### GET /stripe/connect/accounts/:applicationId/:connectedUserId

Retrieve the persisted Stripe connected account ID for a domain user.

### Webhook Endpoints

#### POST /webhooks/paypal

PayPal webhook handler

#### POST /webhooks/stripe

Stripe webhook handler

#### POST /webhooks/payu

PayU webhook handler

#### POST /webhooks/fiobanka

Fio Banka webhook handler

#### POST /webhooks/comgate

ComGate webhook handler

### Health Endpoint

#### GET /health

Returns service health status.

**Response:**

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "service": "payments-microservice"
}
```

## Configuration

### Environment Variables

**Important**: The `.env` file is the single source of truth for all configuration. All hardcoded values have been replaced with environment variables.

See `.env.example` for all required environment variable names (keys only, no values).

#### Service Configuration

- `DOMAIN` - Service domain used by nginx-microservice for auto-registry (required for correct domain detection, default: payments.alfares.cz)
- `SERVICE_NAME` - Service name identifier (default: payments-microservice)
- `SERVICE_PORT` - Internal service port (default: 3468)
- `PORT_BLUE` - Blue deployment host port (default: 3369)
- `PORT_GREEN` - Green deployment host port (default: 3376; must differ from `PORT_BLUE`; **do not use 3371** — reserved on this ecosystem for auth-microservice backend green)
- `NODE_ENV` - Node environment (production/development)

#### Database Configuration

- `DB_HOST` - Database host (required, no default)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (required, no default)
- `DB_PASSWORD` - Database password (required, no default)
- `DB_NAME` - Database name (required, no default)
- `DB_SYNC` - TypeORM synchronize option (true/false)

#### Docker Configuration

- `NGINX_NETWORK_NAME` - Docker network name (default: nginx-network)
- `DOCKER_VOLUME_BASE_PATH` - Base path for Docker volumes (default: /srv/storagebox/statex/docker-volumes)

#### Service URLs

- `API_URL` - API gateway URL
- `FRONTEND_URL` - Frontend URL
- `CORS_ORIGIN` - CORS allowed origin
- `LOGGING_SERVICE_URL` - External logging service URL
- `LOGGING_SERVICE_INTERNAL_URL` - Internal logging service URL (default: `http://logging-microservice:${LOGGING_SERVICE_PORT:-3367}`, port configured in logging-microservice/.env)
- `NOTIFICATION_SERVICE_URL` - Notification service URL
- `AUTH_SERVICE_URL` - Authentication service URL

#### Payment Provider Configuration

**PayU:**

- `PAYU_MERCHANT_ID` - PayU merchant ID
- `PAYU_POS_ID` - PayU POS ID
- `PAYU_CLIENT_ID` - PayU client ID
- `PAYU_CLIENT_SECRET` - PayU client secret
- `PAYU_API_URL` - PayU API URL
- `PAYU_API_URL_PRODUCTION` - PayU production API URL (default: <https://secure.payu.com>)
- `PAYU_API_URL_SANDBOX` - PayU sandbox API URL (default: <https://secure.snd.payu.com>)
- `PAYU_SANDBOX` - Enable PayU sandbox mode (true/false)

**ComGate:**

- `COMGATE_MERCHANT_ID` - ComGate merchant ID
- `COMGATE_SECRET_KEY` - ComGate secret key
- `COMGATE_TEST_MODE` - ComGate test mode (true/false)
- `COMGATE_API_URL` - ComGate API base URL (default: <https://payments.comgate.cz/v1.0>)
- `COMGATE_REDIRECT_BASE_URL` - ComGate redirect base URL (default: <https://payments.comgate.cz/v1.0>)

**Fio Banka:**

- `FIO_BANKA_API_KEY` - Fio Banka API key
- `FIO_BANKA_ACCOUNT_NUMBER` - Fio Banka account number
- `FIO_BANKA_API_URL` - Fio Banka API base URL (default: <https://www.fio.cz/ib_api/rest>)
- `QR_CODE_API_URL` - QR code generation API URL (default: <https://api.qrserver.com/v1/create-qr-code>)

**PayPal:**

- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal client secret
- `PAYPAL_MODE` - PayPal mode (sandbox/live)

**Stripe:**

- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `STRIPE_CONNECT_DEFAULT_COUNTRY` - Connected account default country (example: `US`)
- `STRIPE_CONNECT_ACCOUNT_NAME` - Prefilled `business_profile.name`
- `STRIPE_CONNECT_SUPPORT_PHONE` - Prefilled support/individual phone
- `STRIPE_CONNECT_EXTERNAL_ACCOUNT` - Test external account token (example: `btok_us_verified`)
- `STRIPE_CONNECT_BUSINESS_MCC` - Prefilled business MCC (example: `5045`)
- `STRIPE_CONNECT_CONTROLLER_LOSSES_PAYMENTS` - Connect controller losses payer setting
- `STRIPE_CONNECT_CONTROLLER_STRIPE_DASHBOARD_TYPE` - Connect dashboard type (example: `express`)
- `STRIPE_CONNECT_CONTROLLER_FEES_PAYER` - Connect fees payer setting
- `STRIPE_CONNECT_COMPANY_TAX_ID` - Prefill company tax ID
- `STRIPE_CONNECT_COMPANY_NAME` - Prefill company name
- `STRIPE_CONNECT_COMPANY_CITY` - Prefill company city
- `STRIPE_CONNECT_COMPANY_ADDRESS_LINE1` - Prefill company address line
- `STRIPE_CONNECT_COMPANY_POSTAL_CODE` - Prefill company postal code
- `STRIPE_CONNECT_COMPANY_STATE` - Prefill company state
- `STRIPE_CONNECT_INDIVIDUAL_EMAIL` - Prefill individual email
- `STRIPE_CONNECT_INDIVIDUAL_SSN_LAST_4` - Prefill individual SSN last 4
- `STRIPE_CONNECT_INDIVIDUAL_ID_NUMBER` - Prefill individual ID number
- `STRIPE_CONNECT_INDIVIDUAL_FIRST_NAME` - Prefill individual first name
- `STRIPE_CONNECT_INDIVIDUAL_LAST_NAME` - Prefill individual last name
- `STRIPE_CONNECT_INDIVIDUAL_CITY` - Prefill individual city
- `STRIPE_CONNECT_INDIVIDUAL_ADDRESS_LINE1` - Prefill individual address line
- `STRIPE_CONNECT_INDIVIDUAL_POSTAL_CODE` - Prefill individual postal code
- `STRIPE_CONNECT_INDIVIDUAL_STATE` - Prefill individual state
- `STRIPE_CONNECT_DOCUMENT_FRONT` - File token for verification document (example: `file_identity_document_success`)

**WebPay:**

- `WEBPAY_MERCHANT_ID` - WebPay merchant number (from production: `portal/local_settings.py`)
- `WEBPAY_PASSPHRASE` - Passphrase for RSA key decryption (from production)
- `WEBPAY_URL` - WebPay gateway URL (production: `https://3dsecure.gpwebpay.com/pgw/order.do`, test: `https://test.3dsecure.gpwebpay.com/pgw/order.do`)
- `WEBPAY_PRIVATE_KEY_PATH` - Path to private key file (`keys/des.key`)
- `WEBPAY_PUBLIC_KEY_PATH` - Path to public key file (`keys/publickey.pem`)
- `WEBPAY_ORDER_DESCRIPTION` - Order description sent to GP WebPay (CREATE_ORDER `DESCRIPTION`, included in the digest). Example for speakasap: `SPEAKASAP`

**Inner Payments:**

- Uses same database configuration as main service (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- Accesses `orders_transaction` table from speakasap-portal database

**Invoice Payments:**

- Uses same database configuration as main service (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- Accesses `orders_invoicepayment` table from speakasap-portal database

#### Security

- `API_KEYS` - Comma-separated list of valid **inbound** API keys for protected HTTP routes (for example `POST /payments/create`, `GET /payments/:id`, refunds). Each calling application sends `X-API-Key` with a value that must **exactly match** one of the comma-separated entries (no spaces around commas).
  - **Production**: set this to restrict who may create or query payments. Example: `API_KEYS=flipflop-service,other-app-key`. Then set each client’s outbound key to one of those values (for flipflop: `PAYMENT_API_KEY` in `flipflop-service/.env` must equal one entry).
  - **Empty / unset**: `ApiKeyGuard` treats the allowlist as empty and accepts **any non-empty** `X-API-Key` header (convenient for local dev only). Prefer setting `API_KEYS` in production.
  - After changing `API_KEYS`, **restart** the payments-microservice container so the process reloads `.env`.
- `SPEAKASAP_PORTAL_API_KEY` - Optional default **outbound** key: when set, JSON callbacks include header `X-API-Key: <this value>` unless an app-specific key is configured.
- `PAYMENT_CALLBACK_API_KEYS` - Optional per-application callback API key map in format `applicationId:key,applicationId2:key2`. This lets each consumer microservice validate different callback keys while sharing one payments backend.
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRES_IN` - JWT expiration time

#### Logging

- `LOG_LEVEL` - Log level (debug/info/warn/error)

## Deployment

### Prerequisites

- Docker and Kubernetes
- Access to `nginx-network` Docker network
- PostgreSQL database (shared database-server)
- Environment variables configured in `.env`

### Deploy

```bash
# Edit .env with your configuration
nano .env

# Deploy
./scripts/deploy.sh
```

When run on production (statex), the deploy script automatically registers the service with nginx-microservice so `https://payments.alfares.cz` is routed to this container. Ensure `DOMAIN=payments.alfares.cz` is set in `.env` (used by nginx for SSL and routing). If the domain is unreachable after deploy, run manually: `cd ~/nginx-microservice && ./scripts/blue-green/deploy-smart.sh payments-microservice`.

### Check Status

```bash
./scripts/status.sh
```

## 🔌 Port Configuration

**Port Range**: 33xx (shared microservices)

| Service | Host Port (Blue/Green) | Container Port | .env Variable | Description |
| ------- | -------------------- | -------------- | ------------- | ----------- |
| **Payment Service** | `${PORT_BLUE:-3369}` / `${PORT_GREEN:-3376}` | `${SERVICE_PORT:-3468}` | `PORT_BLUE`, `PORT_GREEN`, `SERVICE_PORT` (payments-microservice/.env) | Payment processing service |

**Note**:

- All ports are configured in `payments-microservice/.env`. The values shown are defaults.
- `PORT_BLUE` and `PORT_GREEN` must be different Kubernetes service DNS so both stacks can bind during deploy; nginx reaches the app on `nginx-network` at container port `${SERVICE_PORT:-3468}`.
- Container port (${SERVICE_PORT:-3468}) differs from host port for internal consistency
- All ports are exposed on `127.0.0.1` only (localhost) for security
- External access is provided via nginx-microservice reverse proxy at `https://payments.alfares.cz`

## Access Methods

### Production Access (HTTPS)

```bash
curl https://payments.alfares.cz/health
```

### Docker Network Access

```bash
# From within a container on nginx-network
# Port configured in payments-microservice/.env: SERVICE_PORT (default: 3468)
curl http://payments-microservice:${SERVICE_PORT:-3468}/health
```

## Integration Example

```typescript
// Example: Creating a payment
const response = await fetch('https://payments.alfares.cz/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
  body: JSON.stringify({
    orderId: 'order-123',
    applicationId: 'e-commerce',
    amount: 1000.00,
    currency: 'CZK',
    paymentMethod: 'payu',
    callbackUrl: 'https://app.alfares.cz/api/payments/callback',
    customer: {
      email: 'customer@example.com',
      name: 'John Doe',
    },
  }),
});

const { data } = await response.json();
// Redirect user to data.redirectUrl for payment
```

## Logs

The service uses a centralized logging system that integrates with the external logging microservice. Logs are sent to the logging microservice via HTTP API and also stored locally as a fallback.

### Logging Configuration

- **External Logging**: Logs are sent to `http://logging-microservice:${PORT:-3367}/api/logs` (port configured in `logging-microservice/.env`)
- **Local Fallback**: If the logging service is unavailable, logs are written to local files in `./logs/` directory
- **Service Name**: All logs are tagged with service name `payments-microservice`

## Security

- **API Key Authentication**: All payment endpoints require valid API key
- **Webhook Signature Verification**: All webhook endpoints verify provider signatures
- **Rate Limiting**: Built-in rate limiting (100 requests per minute)
- **HTTPS**: All production communication uses HTTPS

## Support

For issues and questions, please refer to the main README.md or open an issue on GitHub.
