# Restricted Services – JWT and Role Enforcement

**Last updated**: 2026-02-18

This document describes how JWT validation and role enforcement are set up for restricted microservices and how to configure them (including `.env` and tokens).

---

## What you need to do

1. **Set JWT_SECRET in each service**  
   Use the **same value** as in auth-microservice (from `auth-microservice/.env`) in each restricted service’s `.env`. **Do not commit the value** (`.env` is in `.gitignore`).

2. **Ensure roles exist**  
   After running the RBAC seed, roles like `internal:orders-microservice:admin` exist. Assign `global:superadmin` or the right `internal:<service>:admin` to users who should call these APIs (e.g. via seed `--admin-email=...` or auth admin panel).

3. **Use a JWT when calling protected APIs**  
   Log in via auth-microservice (`POST /auth/login`) and send `Authorization: Bearer <accessToken>` on requests to orders, notifications, payments, suppliers, warehouse. The token’s `roles` claim is used by the guard.

4. **Token in .env (optional)**  
   For scripts or service accounts, put a long-lived token in `.env` (e.g. `SERVICE_TOKEN=...`) and use it as the Bearer token. Generate it via login or a dedicated service user. Add the **key only** in `.env.example`; never commit the token value.

---

## Overview

Restricted services require a valid JWT and the right roles on protected routes. Each service:

- Validates the `Authorization: Bearer <token>` header using the **same JWT_SECRET** as auth-microservice.
- Reads `roles` from the JWT payload (set by auth-microservice when issuing tokens).
- Allows access if the user has at least one of: `global:superadmin` or `internal:<SERVICE_NAME>:admin`.

**Production-ready services** (auth-microservice, database-server, nginx-microservice, logging-microservice) are not modified in this setup; only the services listed below have guards added.

---

## Services with JWT + Roles Implemented

| Service | Stack | Guard | Public routes |
|--------|--------|--------|----------------|
| orders-microservice | NestJS | `JwtRolesGuard` (global) | `GET /api/health` |
| notifications-microservice | NestJS | `JwtRolesGuard` (global) | `/health`, `GET /`, `GET /api` |
| payments-microservice | NestJS | `JwtRolesGuard` (global) | `/health`, `GET /`, `GET /api`, `POST /webhooks/*` |
| suppliers-microservice | NestJS | `JwtRolesGuard` (global) | `GET /api/health` |
| warehouse-microservice | NestJS | `JwtRolesGuard` (global) | `GET /api/health`, `GET /api/ready` |

---

## Required .env for Each Restricted Service

Each service must have in its `.env` (values not committed; keys are in `.env.example`):

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | **Same value as auth-microservice** `JWT_SECRET`. Used to verify JWTs. |
| `AUTH_SERVICE_URL` | Base URL of auth-microservice (e.g. `https://auth.alfares.cz` or `http://auth-microservice:3370`). Optional for guard logic; useful for tooling or future validate-by-call. |
| `SERVICE_NAME` | Service identifier (e.g. `orders-microservice`). Used to build default role `internal:<SERVICE_NAME>:admin`. |
| `SERVICE_TOKEN` | (Optional) Long-lived JWT for scripts or service accounts. Use as `Authorization: Bearer ${SERVICE_TOKEN}`. Key only in `.env.example`; do not commit the value. |

**Important:** `JWT_SECRET` must be identical to auth-microservice’s `JWT_SECRET` so that tokens issued by auth-microservice verify correctly in these services.

---

## Obtaining a JWT (for Testing and Service-to-Service)

Tokens are issued only by **auth-microservice**. Options:

### 1. Login (user token)

- **POST** `{AUTH_SERVICE_URL}/auth/login`  
  Body: `{ "email": "...", "password": "..." }`  
  Response includes `accessToken` and `refreshToken`. Use `accessToken` as `Bearer` in `Authorization`.

### 2. Assign internal admin role and use that user

- Run RBAC seed:  
  `cd auth-microservice && DB_HOST=127.0.0.1 ./scripts/seed-rbac.sh --admin-email=your@email.com`
- Seed creates role `internal:<service>:admin` per service and can assign `global:superadmin` to a user.
- Log in as that user (e.g. via login above) and use the returned `accessToken`.

### 3. Storing a token in .env (optional)

For scripts or service accounts you can store a long-lived token in `.env` (e.g. `SERVICE_TOKEN=eyJ...`) and use it in `Authorization: Bearer ${SERVICE_TOKEN}`. Generate the token by logging in (or via a dedicated service account in auth-microservice) and paste it into `.env`. **Do not commit `.env`.**

---

## Role Format and Defaults

- **global:superadmin** – full platform access (from RBAC seed).
- **internal:&lt;SERVICE_NAME&gt;:admin** – admin for that service (e.g. `internal:orders-microservice:admin`).

Default allowed roles in each service (if no `@Roles()` is set on a route) are:

- `global:superadmin`
- `internal:<SERVICE_NAME>:admin`

So a user needs at least one of these to access non-public routes.

---

## Marking Routes as Public

Routes that must be unauthenticated (health, info, webhooks, etc.) are marked with `@Public()`:

- **orders-microservice:** `GET /api/health`
- **notifications-microservice:** `/health`, `GET /`, `GET /api`
- **payments-microservice:** `/health`, `GET /`, `GET /api`, entire `WebhooksController` (`POST /webhooks/*`)
- **suppliers-microservice:** `GET /api/health`
- **warehouse-microservice:** `GET /api/health`, `GET /api/ready`

All other API routes require a valid JWT and one of the default roles (or a role set via `@Roles()`).

---

## Services Not Modified (Per Project Rules)

- **auth-microservice** – issues JWTs and manages roles; no guard changes.
- **database-server** – production-ready; no code changes.
- **nginx-microservice** – production-ready; no code changes.
- **logging-microservice** – production-ready; no code changes.

To restrict these in the future, the same pattern can be applied: validate JWT with shared `JWT_SECRET` and enforce roles (e.g. `global:superadmin` or `internal:<service>:admin`).

---

## AI Microservice (Python)

ai-microservice is a set of Python (FastAPI) services. To add JWT + role enforcement there:

1. Add dependency: `pip install pyjwt` (or use `python-jose`).
2. Read `JWT_SECRET` and `SERVICE_NAME` from env.
3. Implement a FastAPI dependency or middleware that:
   - Reads `Authorization: Bearer <token>`.
   - Verifies the JWT with `JWT_SECRET` and decodes `roles`.
   - Checks for `global:superadmin` or `internal:ai-microservice:admin` (or the relevant service name).
4. Apply that dependency to protected routes and exclude health/info.

Shared secret and role naming should match the rest of this document.

---

## Checklist for New Restricted Services

1. Add **AuthModule** (or equivalent) with JWT verification and role check.
2. Use **same JWT_SECRET** as auth-microservice in `.env`.
3. Set **SERVICE_NAME** and optional **AUTH_SERVICE_URL** in `.env` / `.env.example`.
4. Mark health and other public routes with **@Public()** (or equivalent).
5. Ensure RBAC seed has created **internal:&lt;SERVICE_NAME&gt;:admin** and assign it (or `global:superadmin`) to users that should access the service.
