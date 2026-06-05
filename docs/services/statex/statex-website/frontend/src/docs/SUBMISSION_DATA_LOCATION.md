# Submission Data Location and Email Notification Flow

**Date:** 2026-01-26  
**Status:** ✅ Submission storage working, ⚠️ Email notification requires full form flow

---

## Where Submission Data is Stored

### Current Storage: In-Memory Database

**Service:** `user-portal` (FastAPI)  
**Location:** In-memory Python dictionaries (`submissions_db`, `users_db`)  
**Persistence:** ⚠️ **NOT PERSISTENT** - Data is lost when container restarts

**Data Structure:**
```python
submissions_db = {
    "user_id_1": [
        {
            "submission_id": "test",
            "user_id": "test-user-12345",
            "page_type": "test",
            "status": "pending",
            "description": "test",
            "created_at": "2026-01-26T14:00:00Z"
        }
    ]
}

users_db = {
    "user_id_1": {
        "user_id": "user_id_1",
        "name": "User",
        "contact_info": [],
        "created_at": datetime.now(),
        "total_submissions": 1
    }
}
```

**Access:**
```bash
# Check stored submissions
docker exec statex-user-portal-green python3 -c "
import sys; sys.path.insert(0, '/app');
from app.main import submissions_db, users_db;
print('Submissions:', submissions_db);
print('Users:', users_db)
"
```

---

## Why No Email Was Sent

### The Issue

When testing the API directly (via `curl`), the submission is created but **no email notification is sent** because:

1. **Direct API test** only calls `/api/users/[userId]/submissions` endpoint
2. This endpoint **only stores** the submission in memory
3. It does **NOT trigger** the notification flow

### The Full Form Flow (Required for Email)

The email notification is sent via a **separate step** in the form submission flow:

```
User fills form
    ↓
FormSection.tsx → handleUserRegistrationAndSubmission()
    ↓
1. Create submission (stores in user-portal) ✅
    ↓
2. Save files to disk (submission-service) ✅
    ↓
3. Send notification (platformNotificationService.sendPrototypeRequest()) ⚠️ MISSING IN DIRECT TEST
    ↓
   → /api/notifications/prototype-request
   → platform-management service
   → Sends email to ADMIN_EMAIL (ssfskype@gmail.com)
```

---

## How to Send Email Notification

### Option 1: Use Full Form Flow (Recommended)

Submit the form through the website UI - this triggers the complete flow including email notification.

### Option 2: Manually Trigger Notification

Call the notification endpoint directly:

```bash
curl -X POST https://alfares.cz/api/notifications/prototype-request \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{
    "name": "Test User",
    "contactType": "email",
    "contactValue": "test@example.com",
    "description": "Test submission",
    "hasRecording": false,
    "recordingTime": 0,
    "files": []
  }'
```

### Option 3: Check Notification Service Directly

```bash
# Check platform-management logs
docker logs statex-platform-management-green | grep -E 'prototype-request|ssfskype|email'

# Check notifications-microservice logs
docker logs notifications-microservice | grep -E 'ssfskype|email|send'
```

---

## Email Configuration

**Admin Email:** Set via `ADMIN_EMAIL` environment variable in `platform-management` service

**Default:** `ssfskype@gmail.com` (if `ADMIN_EMAIL` not set)

**Check current value:**
```bash
docker exec statex-platform-management-green env | grep ADMIN_EMAIL
```

---

## Data Persistence Issue

⚠️ **IMPORTANT:** Current implementation uses in-memory storage. Data is lost when:
- Container restarts
- Service is redeployed
- Container crashes

**Recommendation:** Implement persistent storage (database) for production use.

---

## Next Steps

1. **Test full form flow** through website UI to verify email notification
2. **Check email logs** in notifications-microservice
3. **Verify ADMIN_EMAIL** is set correctly in platform-management service
4. **Consider implementing persistent storage** for submissions

---

## Related Documentation

- [Form Submission Process Flow](form-submission-process-flow.md)
- [API Route Path Preservation Fix](../../../nginx-microservice/docs/API_ROUTE_PATH_PRESERVATION_FIX.md)
