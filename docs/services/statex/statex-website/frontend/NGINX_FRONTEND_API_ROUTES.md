# Frontend API Routes Configuration

## Overview

This document explains how to register Next.js API routes in nginx-microservice so they are handled by the frontend container instead of being intercepted by backend services or API gateway.

## Problem

Nginx-microservice intercepts ALL `/api/*` routes and routes them to:

- Backend services (if `backend` service exists)
- API Gateway (if `api-gateway` service exists)

However, Next.js has its own API routes under `/api/` that should be handled by the frontend container, not backend/API gateway.

## Solution

We've implemented a system to register specific frontend API routes that will be handled by the frontend container.

## How It Works

1. **Configuration File**: `nginx-frontend-api-routes.conf`
   - Lists all Next.js API routes that should go to frontend
   - Located in: `statex-website/frontend/nginx-frontend-api-routes.conf`
   - Format: One route per line, starting with `/api/`

2. **Automatic Registration**: During deployment
   - `deploy-smart.sh` automatically reads `nginx-frontend-api-routes.conf`
   - Adds `frontend_api_routes` array to service registry JSON
   - Nginx config generator creates specific location blocks BEFORE generic `/api/` block

3. **Nginx Configuration**: Generated automatically
   - Specific routes (e.g., `/api/users/collect-contact`) → Frontend
   - Generic `/api/*` routes → Backend/API Gateway

## Adding New Routes

To add a new Next.js API route:

1. Add the route to `nginx-frontend-api-routes.conf`:

   ```text
   /api/your-new-route
   ```

2. Redeploy the service:

   ```bash
   ./nginx-microservice/scripts/blue-green/deploy-smart.sh allegro-service
   ```

3. The route will be automatically registered and nginx will route it to frontend

## Current Registered Routes

- `/api/users/collect-contact` - Contact collection endpoint
- `/api/notifications/prototype-request` - Prototype request notification
- `/api/contact/collect` - Alternative contact collection endpoint

## Technical Details

### Service Registry Structure

The service registry JSON will include:

```json
{
  "frontend_api_routes": [
    "/api/users/collect-contact",
    "/api/notifications/prototype-request",
    "/api/contact/collect"
  ]
}
```

### Nginx Location Blocks

Nginx will generate location blocks like:

```nginx
# Frontend-specific API routes (Next.js API routes, etc.)
# These routes are handled by frontend, not backend/API gateway
location /api/users/collect-contact {
    set $FRONTEND_UPSTREAM statex-frontend-green;
    proxy_pass http://$FRONTEND_UPSTREAM/api/users/collect-contact;
    include /etc/nginx/includes/common-proxy-settings.conf;
    limit_req zone=api burst=20 nodelay;
}

# Generic API routes (handled by backend/API gateway)
location /api/ {
    # ... routes to backend or API gateway
}
```

### Route Matching Priority

Nginx matches location blocks by specificity:

1. Most specific routes (e.g., `/api/users/collect-contact`) are matched first
2. Generic routes (e.g., `/api/`) are matched if no specific route matches

This ensures frontend API routes take precedence over generic backend/API gateway routes.

## Best Practices

1. **Keep routes in codebase**: Store `nginx-frontend-api-routes.conf` in the frontend codebase
2. **Version control**: Commit the config file to git
3. **Document routes**: Add comments explaining what each route does
4. **Test after deployment**: Verify routes work after deployment

## Troubleshooting

If a route is still being intercepted:

1. Check if route is in `nginx-frontend-api-routes.conf`
2. Verify route is in service registry JSON: `jq .frontend_api_routes nginx-microservice/service-registry/allegro-service.json`
3. Check nginx config: `grep -A 5 "location /api/users/collect-contact" /path/to/nginx/config`
4. Redeploy: `./nginx-microservice/scripts/blue-green/deploy-smart.sh allegro-service`
