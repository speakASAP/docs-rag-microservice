# Leads Microservice Integration - StateX Contact Form

## Date: 2026-01-27

## Summary

Successfully migrated StateX contact form from `auth-microservice` user registration to `leads-microservice` for lead management. The form now submits leads directly to the leads-microservice API, eliminating the need for user registration during form submission.

## Changes Made

### 1. Backend Contact Form Route (`statex-website/backend/src/routes/forms.ts`)

**Updated:** `/api/forms/contact` endpoint

**Changes:**

- ✅ Removed dependency on `user-portal` → `auth-microservice` flow
- ✅ Added direct POST to `leads-microservice` at `/api/leads/submit`
- ✅ Maintained disk storage functionality (form data still saved to `/app/data/uploads`)
- ✅ Updated response format to return `leadId`, `status`, and `confirmationSent` from leads-microservice

**New Flow:**

```
Frontend → Backend /api/forms/contact → leads-microservice /api/leads/submit
         ↓
    Disk Storage (still saves form_data.md and session_metadata.json)
```

**Request Format:**

```json
{
  "sourceService": "statex",
  "sourceUrl": "https://alfares.cz/contact",
  "sourceLabel": "contact-form",
  "message": "Form description + file/recording info",
  "contactMethods": [{
    "type": "email|phone|telegram|whatsapp|linkedin",
    "value": "contact@example.com"
  }],
  "metadata": {
    "page": "https://alfares.cz/contact",
    "locale": "en",
    "pageType": "contact",
    "hasVoiceRecording": false,
    "recordingTime": 0,
    "filesCount": 0,
    "sessionId": "...",
    "userId": "..."
  }
}
```

### 2. Frontend FormSection Component

**Status:** ✅ Already integrated with leads-microservice

The frontend `FormSection.tsx` component already submits directly to leads-microservice:

- Line 344: `fetch(\`${env.LEADS_SERVICE_URL}/api/leads/submit\`)`
- No calls to `register-simple` endpoint
- Handles lead submission and confirmation

### 3. Kubernetes Configuration

**Updated:** `docker-compose.blue.yml` and `docker-compose.green.yml`

**Added Environment Variables:**

```yaml
environment:
  - NEXT_PUBLIC_LEADS_SERVICE_URL=${NEXT_PUBLIC_LEADS_SERVICE_URL:-https://leads.${DOMAIN}}
  - LEADS_SERVICE_URL=${LEADS_SERVICE_URL:-https://leads.${DOMAIN}}
```

**Default Values:**

- Production: `https://leads.${DOMAIN}` (e.g., `https://leads.alfares.cz`)
- Development/Docker: `http://leads-microservice:3371`

### 4. User Portal Service

**Status:** ⚠️ Still configured but no longer used for contact forms

The `user-portal` service still has `register-simple` endpoints, but they are **not called** by the contact form anymore. These endpoints can be deprecated in a future phase.

## Integration Verification

### API Endpoints

**Submit Lead:**

```bash
POST https://leads.alfares.cz/api/leads/submit
```

**Query Leads:**

```bash
GET https://leads.alfares.cz/api/leads?sourceService=statex
```

### Environment Variables Required

**Frontend (Next.js):**

- `NEXT_PUBLIC_LEADS_SERVICE_URL` - Public URL for browser-side requests
- `LEADS_SERVICE_URL` - Server-side URL (for API routes)

**Backend (Fastify):**

- `LEADS_SERVICE_URL` - URL for server-side requests

**Default Resolution:**

- Production: `https://leads.${DOMAIN}`
- Docker: `http://leads-microservice:3371`
- Development: `http://localhost:3371`

## Testing Checklist

- [x] Backend route updated to use leads-microservice
- [x] Frontend already uses leads-microservice (verified)
- [x] Docker compose files updated with LEADS_SERVICE_URL
- [ ] Test form submission via browser
- [ ] Verify lead appears in leads-microservice
- [ ] Verify form data saved to disk
- [ ] Verify notification sent to admin

## Deployment Steps

1. **Pull latest code:**

   ```bash
   ssh alfares "cd statex && git pull"
   ```

2. **Rebuild and restart frontend:**

   ```bash
   ssh alfares "cd statex && docker compose -f docker-compose.blue.yml up -d --build frontend"
   ```

3. **Verify environment variables:**

   ```bash
   ssh alfares "cd statex && docker exec statex-frontend-blue env | grep LEADS"
   ```

4. **Test form submission:**
   - Navigate to <https://alfares.cz/contact>
   - Fill out and submit form
   - Check logs: `docker logs statex-frontend-blue --tail 100 | grep leads`
   - Verify lead: `curl -k https://leads.alfares.cz/api/leads?sourceService=statex`

5. **Verify disk storage:**

   ```bash
   ssh alfares "cd statex && docker exec statex-frontend-blue find /app/data/uploads/users -name 'form_data.md' -exec cat {} \;"
   ```

## Benefits

1. **Simplified Flow:** No user registration required for form submissions
2. **Centralized Lead Management:** All leads go through leads-microservice
3. **Better Tracking:** Leads can be queried and managed via leads-microservice API
4. **Automatic Notifications:** Leads-microservice handles confirmation emails
5. **Future-Proof:** User registration can be added later as a separate phase

## Notes

- Form data is still saved to disk for backup/reference
- User registration endpoints (`/api/users/register-simple`) are still available but not used by contact forms
- Leads-microservice handles all notifications and confirmations
- The backend route maintains backward compatibility with existing storage functionality

## Next Steps

1. Deploy updated code to production
2. Test form submission end-to-end
3. Monitor leads-microservice logs for any issues
4. Consider deprecating unused user registration endpoints in future phase
