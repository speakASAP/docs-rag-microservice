# Leads Microservice Integration - Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Changes

- [x] Backend `/api/forms/contact` route updated to use leads-microservice
- [x] Frontend `FormSection.tsx` already uses leads-microservice (no changes needed)
- [x] Docker compose files updated with `LEADS_SERVICE_URL` environment variables
- [x] Removed dependency on `user-portal` → `auth-microservice` for contact forms

### API Testing

- [x] Leads-microservice API accessible: `https://leads.alfares.cz/api/leads/submit`
- [x] Test submission successful: Lead ID `471eb339-1e4c-48b4-aaeb-57495ae838b2` created
- [x] Query endpoint working: `GET /api/leads?sourceService=statex` returns leads

### Configuration

- [x] Environment variables added to docker-compose.blue.yml
- [x] Environment variables added to docker-compose.green.yml
- [ ] Verify `.env` file has `LEADS_SERVICE_URL` (or will use default `https://leads.${DOMAIN}`)

## 🚀 Deployment Steps

### 1. Pull Latest Code

```bash
ssh alfares "cd statex && git pull"
```

### 2. Rebuild Frontend (Blue)

```bash
ssh alfares "cd statex && docker compose -f docker-compose.blue.yml up -d --build frontend"
```

### 3. Verify Environment Variables

```bash
ssh alfares "cd statex && docker exec statex-frontend-blue env | grep LEADS"
```

Expected output:

```text
NEXT_PUBLIC_LEADS_SERVICE_URL=https://leads.alfares.cz
LEADS_SERVICE_URL=https://leads.alfares.cz
```

### 4. Test Form Submission

1. Navigate to: <https://alfares.cz/contact>
2. Fill out form:
   - Name: Test User
   - Contact Type: Email
   - Contact Value: <test@example.com>
   - Description: Test form submission
3. Submit form
4. Check browser console for success message

### 5. Verify Lead Created

```bash
ssh alfares "cd statex && curl -k 'https://leads.alfares.cz/api/leads?sourceService=statex' | jq '.items[] | {id, status, sourceLabel, contactMethods}'"
```

### 6. Verify Form Data Saved to Disk

```bash
ssh alfares "cd statex && docker exec statex-frontend-blue find /app/data/uploads/users -name 'form_data.md' -mmin -5 -exec cat {} \;"
```

### 7. Check Logs

```bash
# Frontend logs
ssh alfares "cd statex && docker logs statex-frontend-blue --tail 100 | grep -E 'leads-microservice|lead submitted|LEADS'"

# Backend logs (if backend is separate)
ssh alfares "cd statex && docker logs statex-backend-blue --tail 100 | grep -E 'leads-microservice|Submitting lead'"
```

## 🔍 Post-Deployment Verification

### Success Criteria

- [ ] Form submission returns 200 OK (no 500 errors)
- [ ] Lead appears in leads-microservice (`GET /api/leads?sourceService=statex`)
- [ ] Form data saved to `/app/data/uploads/users/{userId}/sessions/{sessionId}/form_data.md`
- [ ] No errors in frontend/backend logs
- [ ] Confirmation email sent (handled by leads-microservice)

### Rollback Plan

If issues occur:

1. Revert to previous docker-compose configuration
2. Restart frontend: `docker compose -f docker-compose.blue.yml restart frontend`
3. Check logs for errors

## 📝 Notes

- **User Registration:** Contact forms no longer register users via auth-microservice
- **Lead Management:** All leads are managed through leads-microservice
- **Disk Storage:** Form data is still saved to disk for backup/reference
- **Notifications:** Handled automatically by leads-microservice via notifications-microservice

## 🐛 Troubleshooting

### Issue: 500 Error on Form Submission

**Check:**

- LEADS_SERVICE_URL environment variable is set correctly
- Leads-microservice is accessible from frontend container
- Network connectivity: `docker exec statex-frontend-blue curl -k https://leads.alfares.cz/health`

### Issue: Lead Not Created

**Check:**

- Leads-microservice logs: `docker logs leads-microservice-blue --tail 100`
- API response in browser console
- Network errors in browser DevTools

### Issue: Form Data Not Saved

**Check:**

- Storage directory permissions: `docker exec statex-frontend-blue ls -la /app/data/uploads`
- Backend logs for storage errors
- Disk space: `df -h`
