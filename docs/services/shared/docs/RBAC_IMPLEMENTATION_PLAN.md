# RBAC Implementation Plan

## Role-Based Access Control System for Statex Microservices Ecosystem

**Created**: 2026-02-18  
**Status**: Implementation In Progress  
**Version**: 1.0

---

## 📋 Executive Summary

This document outlines the implementation of a centralized Role-Based Access Control (RBAC) system for the Statex microservices ecosystem. The system will provide:

- **Single Identity Store**: One user account works across all applications and microservices
- **Granular Access Control**: Role-based permissions for applications and internal services
- **Application Registration**: Automatic registration of applications during deployment
- **JWT-Based Authorization**: Tokens include user roles for efficient authorization checks

---

## 🎯 Goals

1. **Centralized User Management**: All user identities stored in `auth-microservice`
2. **Role-Based Access**: Users have roles that determine access to applications and internal services
3. **Application Classification**: Distinguish between user-facing apps and internal microservices
4. **Automatic Registration**: Applications register themselves during deployment
5. **Global Superuser Support**: Superadmin role for platform-wide access

---

## 🏗️ Architecture Overview

### Current State

- ✅ Centralized `auth-microservice` with user registration/login
- ✅ JWT tokens issued by `auth-microservice`
- ✅ Shared `JWT_SECRET` across all services
- ❌ No role system
- ❌ No application registration
- ❌ No authorization middleware

### Target State

```text
┌──────────────────────────────────────────────────────────┐
│                   auth-microservice                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Users      │  │ Applications │  │    Roles     │    │
│  │              │  │              │  │              │    │
│  │ - id         │  │ - id         │  │ - id         │    │
│  │ - email      │  │ - name       │  │ - name       │    │
│  │ - password   │  │ - type       │  │ - scope      │    │
│  │ - ...        │  │ - domain     │  │ - ...        │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                    ┌──────────────┐                      │
│                    │ UserRoles    │                      │
│                    │ - userId     │                      │
│                    │ - roleId     │                      │
│                    │ - appId      │                      │
│                    └──────────────┘                      │
└──────────────────────────────────────────────────────────┘
                            │
                            │ JWT with roles
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼──────┐  ┌─────────▼────────┐   ┌───────▼──────┐
│ Applications │  │   Applications   │   │  Internal    │
│ (user-facing)│  │   (user-facing)  │   │ Microservices│
│              │  │                  │   │              │
│shop-assistant│  │  beauty, crypto  │   │ ai, logging, │
│ marathon     │  │ etc.             │   │ auth, etc.   │
└──────────────┘  └──────────────────┘   └──────────────┘
```

---

## 📊 Database Schema

### New Tables

#### 1. `applications` Table

Stores registered applications and microservices.

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,           -- e.g., 'shop-assistant', 'ai-microservice'
  display_name VARCHAR(255),                  -- e.g., 'Shop Assistant', 'AI Microservice'
  type VARCHAR(50) NOT NULL,                  -- 'user_facing' | 'internal' | 'infrastructure'
  domain VARCHAR(255),                         -- e.g., 'shop-assistant.alfares.cz'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applications_name ON applications(name);
CREATE INDEX idx_applications_type ON applications(type);
CREATE INDEX idx_applications_domain ON applications(domain);
```

**Application Types**:

- `user_facing`: Public applications where users can register (shop-assistant, beauty, crypto-ai-agent, marathon)
- `internal`: Internal microservices requiring admin access (ai-microservice, logging-microservice, notifications-microservice)
- `infrastructure`: Infrastructure services (nginx-microservice, database-server, auth-microservice)

#### 2. `roles` Table

Stores role definitions.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,                  -- e.g., 'superadmin', 'user', 'admin'
  scope VARCHAR(100) NOT NULL,                -- 'global' | 'application' | 'internal'
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, scope, application_id)
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_scope ON roles(scope);
CREATE INDEX idx_roles_application_id ON roles(application_id);
```

**Role Scopes**:

- `global`: Platform-wide roles (e.g., `global:superadmin`, `global:platform_admin`)
- `application`: Per-application roles (e.g., `app:shop-assistant:user`, `app:shop-assistant:admin`)
- `internal`: Internal service roles (e.g., `internal:logging:admin`, `internal:ai:admin`)

**Predefined Roles**:

- `global:superadmin` - Full platform access (you, trusted devs)
- `global:platform_admin` - Infrastructure management access
- `app:{app-name}:user` - Standard user role for each app
- `app:{app-name}:admin` - Admin role for each app
- `internal:{service-name}:admin` - Admin access to internal services

#### 3. `user_roles` Table

Junction table for user-role assignments.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),      -- Who granted this role
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,                       -- Optional expiration
  UNIQUE(user_id, role_id, application_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_application_id ON user_roles(application_id);
```

**Note**: `application_id` is:

- `NULL` for global roles
- Set to application ID for application-scoped roles
- Set to internal service ID for internal roles

### Updated Tables

#### `users` Table

Add optional fields (backward compatible):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'end_user';
-- Values: 'end_user' | 'staff' | 'service' | 'admin'
```

---

## 🔐 JWT Token Structure

### Current JWT Payload

```json
{
  "sub": "user-uuid"
}
```

### New JWT Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "type": "end_user",
  "roles": [
    "global:superadmin",
    "app:shop-assistant:user",
    "app:beauty:admin",
    "internal:logging:admin"
  ],
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Token Claims**:

- `sub`: User ID (required)
- `email`: User email (for convenience)
- `type`: User type (`end_user`, `staff`, `service`, `admin`)
- `roles`: Array of role strings (e.g., `["global:superadmin", "app:shop-assistant:user"]`)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

---

## 🚀 Implementation Phases

### Phase 1: Database Schema ✅

**Tasks**:

1. Create migration files for new tables (`applications`, `roles`, `user_roles`)
2. Add `user_type` column to `users` table
3. Create TypeORM entities for new tables
4. Seed initial data:
   - Register all existing applications
   - Create predefined roles
   - Assign `global:superadmin` to your user

**Files to Create**:

- `auth-microservice/src/applications/entities/application.entity.ts`
- `auth-microservice/src/roles/entities/role.entity.ts`
- `auth-microservice/src/user-roles/entities/user-role.entity.ts`
- `auth-microservice/src/database/migrations/XXXXXX-create-rbac-tables.ts`

**Files to Modify**:

- `auth-microservice/src/users/entities/user.entity.ts` (add `userType` field)

---

### Phase 2: JWT Token Enhancement ✅

**Tasks**:

1. Update `generateTokens()` method to include roles
2. Create `getUserRoles()` method to fetch user roles from database
3. Include roles in JWT payload

**Files to Modify**:

- `auth-microservice/src/auth/auth.service.ts`
  - Update `generateTokens()` method
  - Add `getUserRoles(userId: string)` method

**Files to Create**:

- `auth-microservice/src/roles/roles.service.ts`
  - `getUserRoles(userId: string): Promise<string[]>`
  - `getUserRolesForApplication(userId: string, appId: string): Promise<string[]>`

---

### Phase 3: Application Registration System ✅

**Tasks**:

1. Create application registration API endpoints
2. Add automatic registration during deployment
3. Update deploy scripts to register applications

**API Endpoints**:

```text
POST /auth/admin/applications/register
  - Register a new application
  - Requires: global:superadmin or global:platform_admin role
  - Body: { name, displayName, type, domain, description }

GET /auth/admin/applications
  - List all registered applications
  - Requires: global:superadmin or global:platform_admin role

PUT /auth/admin/applications/:id
  - Update application details
  - Requires: global:superadmin or global:platform_admin role
```

**Environment Variables**:

Add to each application's `.env`:

```bash
# Application Registration
APP_NAME=shop-assistant                    # Unique identifier (matches service name)
APP_DISPLAY_NAME=Shop Assistant            # Human-readable name
APP_TYPE=user_facing                       # user_facing | internal | infrastructure
APP_DOMAIN=shop-assistant.alfares.cz       # Domain (optional, for user-facing apps)
```

**Deployment Integration**:

Update `nginx-microservice/scripts/blue-green/deploy-smart.sh`:

- After service registry creation, call auth-microservice to register application
- Use service name from registry as `APP_NAME`
- Read `APP_TYPE` from application's `.env` file

**Files to Create**:

- `auth-microservice/src/applications/applications.service.ts`
- `auth-microservice/src/applications/applications.controller.ts`
- `auth-microservice/src/applications/applications.module.ts`
- `auth-microservice/scripts/register-application.sh` (for manual registration)

**Files to Modify**:

- `nginx-microservice/scripts/blue-green/deploy-smart.sh` (add app registration step)
- Each application's `.env` and `.env.example` (add APP_* variables)

---

### Phase 4: Authorization Middleware ✅

**Tasks**:

1. Create reusable authorization middleware
2. Support role-based checks
3. Create decorators for easy use

**Middleware Features**:

- Validate JWT token
- Extract roles from token
- Check if user has required role(s)
- Support multiple role requirements (AND/OR logic)

**Usage Examples**:

```typescript
// Require any of these roles
@Roles('app:shop-assistant:user', 'app:shop-assistant:admin')
@Get('/products')
async getProducts() { ... }

// Require all roles (AND logic)
@Roles('app:shop-assistant:admin', 'global:superadmin', { requireAll: true })
@Delete('/products/:id')
async deleteProduct() { ... }

// Require global superadmin
@Roles('global:superadmin')
@Get('/admin/users')
async getAllUsers() { ... }

// Require internal service admin
@Roles('internal:logging:admin')
@Get('/logs')
async getLogs() { ... }
```

**Files to Create**:

- `auth-microservice/src/auth/guards/roles.guard.ts` (NestJS guard)
- `auth-microservice/src/auth/decorators/roles.decorator.ts`
- `auth-microservice/src/auth/decorators/current-user.decorator.ts`
- Shared middleware for other services (TypeScript/Python)

**Files to Create (Shared)**:

- `shared/auth/roles.middleware.ts` (for NestJS apps)
- `shared/auth/roles_decorator.py` (for Python/FastAPI apps)

---

### Phase 5: Admin API for Role Management ✅

**Tasks**:

1. Create admin endpoints for role management
2. Create admin UI (optional, can use API directly)
3. Add audit logging for role changes

**API Endpoints**:

```text
# Role Management
GET /auth/admin/roles
  - List all roles
  - Requires: global:superadmin or global:platform_admin

POST /auth/admin/roles
  - Create a new role
  - Requires: global:superadmin
  - Body: { name, scope, applicationId, description }

# User Role Assignment
GET /auth/admin/users/:userId/roles
  - Get all roles for a user
  - Requires: global:superadmin or global:platform_admin

POST /auth/admin/users/:userId/roles
  - Assign role to user
  - Requires: global:superadmin
  - Body: { roleId, applicationId?, expiresAt? }

DELETE /auth/admin/users/:userId/roles/:roleId
  - Remove role from user
  - Requires: global:superadmin

# Application Management
GET /auth/admin/applications
POST /auth/admin/applications/register
PUT /auth/admin/applications/:id
DELETE /auth/admin/applications/:id
```

**Files to Create**:

- `auth-microservice/src/admin/admin.controller.ts`
- `auth-microservice/src/admin/admin.service.ts`
- `auth-microservice/src/admin/admin.module.ts`
- `auth-microservice/src/admin/dto/` (DTOs for admin operations)

---

### Phase 6: Integration with Existing Services ✅

**Tasks**:

1. Update user-facing applications to use role checks
2. Update internal microservices to require admin roles
3. Update shared auth services to support roles

**User-Facing Applications**:

- `shop-assistant`: Add role checks for admin endpoints
- `beauty`: Add role checks for admin endpoints
- `crypto-ai-agent`: Add role checks for admin endpoints
- `marathon`: Add role checks for admin endpoints

**Internal Microservices**:

- `ai-microservice`: Require `internal:ai:admin` or `global:superadmin`
- `logging-microservice`: Require `internal:logging:admin` or `global:superadmin`
- `notifications-microservice`: Require `internal:notifications:admin` or `global:superadmin`
- `auth-microservice`: Require `internal:auth:admin` or `global:superadmin` for admin endpoints

**Files to Modify**:

- Each application's auth middleware/guards
- Shared auth services in each application

---

### Phase 7: Documentation ✅

**Tasks**:

1. Update README.md with RBAC system documentation
2. Create RBAC usage guide
3. Document role assignment process
4. Update CREATE_SERVICE.md with app registration steps

**Documentation Files**:

- `docs/RBAC_SYSTEM.md` - Complete RBAC system documentation
- `docs/RBAC_USAGE_GUIDE.md` - How to use RBAC in applications
- `docs/ROLE_MANAGEMENT.md` - How to manage roles and user assignments
- Update `README.md` - Add RBAC section
- Update `CREATE_SERVICE.md` - Add app registration steps

---

## 🔧 Configuration

### Environment Variables

#### auth-microservice/.env

```bash
# RBAC Configuration
RBAC_ENABLED=true
DEFAULT_USER_ROLE=app:{app-name}:user  # Default role for new registrations
```

#### Application .env (each app)

```bash
# Application Registration
APP_NAME=shop-assistant                    # Must match service name
APP_DISPLAY_NAME=Shop Assistant
APP_TYPE=user_facing                       # user_facing | internal | infrastructure
APP_DOMAIN=shop-assistant.alfares.cz       # Optional
```

---

## 📝 Migration Strategy

### Step 1: Deploy Database Changes

1. Run migrations to create new tables
2. Seed initial applications (from existing services)
3. Create predefined roles

### Step 2: Update auth-microservice

1. Deploy updated auth-microservice with RBAC support
2. JWT tokens will start including roles
3. Old tokens without roles will still work (backward compatible)

### Step 3: Register Applications

1. Update each application's `.env` with `APP_*` variables
2. Redeploy applications (deploy script will auto-register)
3. Or manually register via admin API

### Step 4: Assign Initial Roles

1. Assign `global:superadmin` to your user
2. Assign default roles to existing users (optional)
3. Test role-based access

### Step 5: Update Services

1. Add role checks to protected endpoints
2. Test authorization
3. Monitor logs for authorization failures

---

## 🧪 Testing Strategy

### Unit Tests

- Role assignment logic
- JWT token generation with roles
- Role checking middleware

### Integration Tests

- Application registration
- User role assignment
- Authorization checks

### Manual Testing

1. Register a new application
2. Assign roles to users
3. Test access with different roles
4. Verify JWT tokens include roles

---

## 🔒 Security Considerations

1. **Role Escalation Prevention**: Only `global:superadmin` can assign roles
2. **Token Validation**: All services validate JWT tokens using shared `JWT_SECRET`
3. **Audit Logging**: All role changes logged to logging-microservice
4. **Principle of Least Privilege**: Users get minimal roles by default
5. **Token Expiration**: Tokens expire; refresh required
6. **Role Expiration**: Optional expiration for role assignments

---

## 📊 Monitoring & Logging

### Log Events

- Application registration
- Role assignments/removals
- Authorization failures
- Token generation with roles

### Metrics

- Number of applications registered
- Number of roles defined
- Number of users with roles
- Authorization success/failure rates

---

## 🎯 Success Criteria

1. ✅ All applications registered in auth-microservice
2. ✅ JWT tokens include user roles
3. ✅ Authorization middleware works across all services
4. ✅ Admin can assign roles to users
5. ✅ Internal services require admin roles
6. ✅ User-facing apps use role-based access
7. ✅ Documentation complete

---

## 📅 Timeline

- **Phase 1-2**: Database + JWT (Day 1)
- **Phase 3**: Application Registration (Day 2)
- **Phase 4**: Authorization Middleware (Day 2-3)
- **Phase 5**: Admin API (Day 3)
- **Phase 6**: Integration (Day 4-5)
- **Phase 7**: Documentation (Day 5)

**Total Estimated Time**: 5 days

---

## 🔄 Future Enhancements

1. **Permission System**: Fine-grained permissions beyond roles
2. **Role Hierarchies**: Inherit permissions from parent roles
3. **Dynamic Roles**: Roles based on user attributes
4. **Multi-Tenancy**: Tenant-specific roles
5. **Role Templates**: Predefined role sets for common scenarios
6. **Admin UI**: Web interface for role management

---

**Last Updated**: 2026-02-18  
**Status**: Ready for Implementation
