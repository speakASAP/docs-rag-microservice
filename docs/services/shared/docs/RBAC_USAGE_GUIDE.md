# RBAC Usage Guide

## How to Use Role-Based Access Control in Your Applications

**Last Updated**: 2026-02-18

---

## 📋 Overview

The RBAC system provides centralized user management and role-based authorization across all microservices. This guide explains how to use it in your applications.

---

## 🔑 Key Concepts

### User Identity

- **Single Identity**: One user account works across all applications
- **Centralized Storage**: All users stored in `auth-microservice`
- **JWT Tokens**: Include user ID, email, type, and roles

### Roles

Roles follow the pattern: `scope:name` or `scope:app-name:name`

**Scopes**:

- `global:*` - Platform-wide roles (e.g., `global:superadmin`)
- `app:*:*` - Per-application roles (e.g., `app:shop-assistant:user`)
- `internal:*:*` - Internal service roles (e.g., `internal:logging:admin`)

**Examples**:

- `global:superadmin` - Full platform access
- `app:shop-assistant:user` - Standard user for shop-assistant
- `app:shop-assistant:admin` - Admin for shop-assistant
- `internal:ai-microservice:admin` - Admin access to AI microservice

---

## 🚀 Getting Started

### 1. Initial Setup

Run the seed script to initialize RBAC system:

```bash
cd auth-microservice
./scripts/seed-rbac.sh --admin-email=your@email.com
```

This will:

- Register all applications
- Create predefined roles
- Assign `global:superadmin` to your user

### 2. Application Registration

Applications are automatically registered during deployment via `deploy-smart.sh`. Manual registration:

```bash
# From application directory
cd shop-assistant
../auth-microservice/scripts/register-application.sh shop-assistant
```

Or via API (requires authentication):

```bash
curl -X POST https://auth.alfares.cz/auth/admin/applications/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "shop-assistant",
    "displayName": "Shop Assistant",
    "type": "user_facing",
    "domain": "shop-assistant.alfares.cz"
  }'
```

---

## 🔐 Using RBAC in Your Application

### NestJS Applications

#### 1. Install Dependencies

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
```

#### 2. Create Auth Guard

```typescript
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const userRoles = payload.roles || [];
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasRole) {
        throw new ForbiddenException('Insufficient permissions');
      }

      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

#### 3. Create Roles Decorator

```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

#### 4. Use in Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';

@Controller('products')
@UseGuards(RolesGuard)
export class ProductsController {
  @Get()
  @Roles('app:shop-assistant:user', 'app:shop-assistant:admin')
  async getProducts() {
    // Any user with app:shop-assistant:user OR app:shop-assistant:admin can access
    return { products: [] };
  }

  @Get('admin')
  @Roles('app:shop-assistant:admin', 'global:superadmin')
  async getAdminProducts() {
    // Only admins can access
    return { adminProducts: [] };
  }
}
```

### Python/FastAPI Applications

#### 1. Create Auth Dependency

```python
# utils/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*required_roles: str):
    async def role_checker(user: dict = Depends(get_current_user)):
        user_roles = user.get("roles", [])
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker
```

#### 2. Use in Routes

```python
from fastapi import APIRouter, Depends
from utils.auth import require_role

router = APIRouter()

@router.get("/products")
async def get_products(user: dict = Depends(require_role("app:shop-assistant:user", "app:shop-assistant:admin"))):
    return {"products": []}

@router.get("/admin/products")
async def get_admin_products(user: dict = Depends(require_role("app:shop-assistant:admin", "global:superadmin"))):
    return {"adminProducts": []}
```

---

## 👥 Managing Roles

### Assign Role to User

```bash
# Get user ID
curl https://auth.alfares.cz/auth/admin/users | jq '.users[] | select(.email=="user@example.com")'

# Get role ID
curl https://auth.alfares.cz/auth/admin/roles | jq '.roles[] | select(.name=="admin" and .scope=="application")'

# Assign role
curl -X POST https://auth.alfares.cz/auth/admin/users/{userId}/roles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": "role-uuid",
    "applicationId": "app-uuid"
  }'
```

### Remove Role from User

```bash
curl -X DELETE https://auth.alfares.cz/auth/admin/users/{userId}/roles/{roleId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 Checking User Roles

### From JWT Token

JWT tokens include roles in the payload:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "type": "end_user",
  "roles": [
    "app:shop-assistant:user",
    "app:beauty:admin"
  ]
}
```

### From API

```bash
curl https://auth.alfares.cz/auth/admin/users/{userId}/roles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Best Practices

1. **Principle of Least Privilege**: Assign minimal roles needed
2. **Role Naming**: Use consistent naming (`user`, `admin`, `moderator`)
3. **Scope Appropriately**: Use `app:*` for user-facing apps, `internal:*` for microservices
4. **Test Authorization**: Always test role-based access
5. **Log Authorization Failures**: Log when users are denied access

---

## 🐛 Troubleshooting

### Token Doesn't Include Roles

- Ensure user has roles assigned
- User must re-login to get new token with roles
- Check `auth-microservice` logs for role assignment

### Authorization Fails

- Verify JWT_SECRET matches across all services
- Check token expiration
- Verify role names match exactly (case-sensitive)

### Application Not Registered

- Run seed script: `./scripts/seed-rbac.sh`
- Or register manually via API
- Check `auth-microservice` logs

---

## 📚 Related Documentation

- [RBAC Implementation Plan](./RBAC_IMPLEMENTATION_PLAN.md)
- [RBAC Implementation Status](./RBAC_IMPLEMENTATION_STATUS.md)
- [Auth Microservice README](../auth-microservice/README.md)

---

**Last Updated**: 2026-02-18
