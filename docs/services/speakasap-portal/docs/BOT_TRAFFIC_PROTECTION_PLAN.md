# Bot Traffic Protection Plan

## Objective

Reduce bot/scanner impact on public API endpoints without touching nginx configuration.

## Scope

- Existing application middleware and settings only.
- Target endpoints: `/api/auth/*` and `/api/custom_courses/*` (configurable).

## Implementation Tasks

### ✅ Task 1: Keep malformed `Accept` from crashing API

- Added `AcceptHeaderFixMiddleware` to normalize non-ASCII `Accept` headers to `*/*`.
- Prevents DRF content negotiation crash (`UnicodeDecodeError`).

### ✅ Task 2: Add suspicious-request throttling

- Added `SuspiciousRequestThrottleMiddleware`.
- For configured API prefixes, counts suspicious requests per `IP + path + time-window` in cache.
- Returns `429 Too many suspicious requests` after threshold.

### ✅ Task 3: Make thresholds configurable via environment

- Added settings:
  - `BOT_PROTECTION_WINDOW_SECONDS` (default: `120`)
  - `BOT_PROTECTION_MAX_SUSPICIOUS_REQUESTS` (default: `20`)
  - `BOT_PROTECTION_API_PREFIXES` (default: `/api/auth/,/api/custom_courses/`)

## Result

- Malformed bot headers no longer produce 500.
- Repetitive suspicious traffic is rate-limited at application layer.
- Behavior can be tuned via env variables without code changes.
