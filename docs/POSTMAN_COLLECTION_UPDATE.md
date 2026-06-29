# Postman Collection Update - API Versioning

## Summary

Updated Postman collection to reflect new API v1 versioning structure and added health check endpoints.

---

## Changes Made

### 1. API Versioning Applied

**Old URLs (Mixed):**
```
/api/auth/register          ❌ No version
/api/auth/login             ❌ No version
/api/v1/app/profile/get     ✅ Has version
/api/v1/admin/users/list    ✅ Has version
```

**New URLs (Consistent v1):**
```
/api/v1/auth/register       ✅ Versioned
/api/v1/auth/login          ✅ Versioned
/api/v1/app/profile/get     ✅ Versioned
/api/v1/admin/users/list    ✅ Versioned
```

### 2. New Health Check Endpoints Added

```
GET /api/health                   - Basic health check
GET /api/health/detailed          - Detailed health with DB status
GET /api/health/ready             - Kubernetes readiness probe
GET /api/health/live              - Kubernetes liveness probe
GET /api/health/metrics           - Database metrics
```

### 3. Collection Organization

**New Folder Structure:**
1. **Health & Monitoring** (5 endpoints) - NEW
2. **Authentication (v1)** (2 endpoints) - Updated paths
3. **Public Routes (v1)** (2 endpoints) - Updated paths
4. **App - Profile (v1)** (3 endpoints) - Already versioned
5. **App - Sync (v1)** (10 endpoints) - Already versioned
6. **Admin - Users (v1)** (4 endpoints) - Already versioned
7. **Admin - Inquiries (v1)** (6 endpoints) - Already versioned
8. **Admin - Dashboard (v1)** (2 endpoints) - Already versioned

**Total Endpoints:** 34 (was 32, added 2 new health checks)

---

## Files

### Old Collection
- **File:** `Workdesk24_API.postman_collection.json`
- **Status:** ⚠️ Outdated (mixed versioning)
- **Keep for:** Backward compatibility reference

### New Collection
- **File:** `Workdesk24_API_v2.postman_collection.json`
- **Status:** ✅ Updated with v1 versioning
- **Use for:** All new API testing

---

## Import Instructions

### Option 1: Import New Collection

1. Open Postman
2. Click **Import**
3. Select `Workdesk24_API_v2.postman_collection.json`
4. Click **Import**

### Option 2: Replace Old Collection

1. Delete old "Workdesk24 API v1 - Complete" collection
2. Import `Workdesk24_API_v2.postman_collection.json`

---

## Breaking Changes

### Authentication Endpoints

**Before:**
```
POST http://localhost:3000/api/auth/register
POST http://localhost:3000/api/auth/login
```

**After:**
```
POST http://localhost:3000/api/v1/auth/register
POST http://localhost:3000/api/v1/auth/login
```

**Impact:** 
- ⚠️ Old endpoints will return 404
- Update mobile app and frontend to use `/v1/auth` paths

### Public Endpoints

**Before:**
```
POST /api/v1/public/inquiries
```

**After:**
```
POST /api/v1/public/inquiries  (unchanged)
```

**Impact:** ✅ No change (already versioned)

### App Endpoints

**Before:**
```
POST /api/v1/app/profile/get
POST /api/v1/app/sync/attendance
```

**After:**
```
POST /api/v1/app/profile/get  (unchanged)
POST /api/v1/app/sync/attendance  (unchanged)
```

**Impact:** ✅ No change (already versioned)

### Admin Endpoints

**Before:**
```
POST /api/v1/admin/users/list
POST /api/v1/admin/inquiries/list
```

**After:**
```
POST /api/v1/admin/users/list  (unchanged)
POST /api/v1/admin/inquiries/list  (unchanged)
```

**Impact:** ✅ No change (already versioned)

---

## Testing Workflow

### 1. Basic Health Check

```bash
# Test server is running
GET {{BASE_URL}}/api/health

Expected Response (200 OK):
{
  "status": "healthy",
  "timestamp": "2026-05-30T...",
  "uptime": 123.45
}
```

### 2. Detailed Health Check

```bash
# Test database connection
GET {{BASE_URL}}/api/health/detailed

Expected Response (200 OK):
{
  "status": "healthy",
  "database": {
    "isConnected": true,
    "isHealthy": true,
    "responseTime": 5
  }
}
```

### 3. Authentication Flow

```bash
# 1. Register
POST {{BASE_URL}}/api/v1/auth/register
Body: {"email": "test@example.com", "password": "test123", "name": "Test User"}

# 2. Login (auto-saves token)
POST {{BASE_URL}}/api/v1/auth/login
Body: {"email": "test@example.com", "password": "test123"}

# Token automatically saved to {{TOKEN}} variable
```

### 4. Authenticated Request

```bash
# Use saved token
POST {{BASE_URL}}/api/v1/app/profile/get
Headers: Authorization: Bearer {{TOKEN}}
Body: {}
```

---

## Environment Variables

The collection uses these variables:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `BASE_URL` | `http://localhost:3000` | Server base URL |
| `TOKEN` | (empty) | JWT token (auto-filled on login) |

### Update for Production

1. Click environment dropdown
2. Select "Workdesk24 API v1 - Updated"
3. Update `BASE_URL`:
   - Staging: `https://staging-api.workdesk24.com`
   - Production: `https://api.workdesk24.com`

---

## Token Management

### Automatic Token Extraction

The Login request has a **test script** that automatically extracts and saves the JWT token:

```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.token) {
        pm.collectionVariables.set("TOKEN", response.token);
    } else if (response.data && response.data.token) {
        pm.collectionVariables.set("TOKEN", response.data.token);
    } else {
        const authHeader = pm.response.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.substring(7);
            pm.collectionVariables.set("TOKEN", token);
        }
    }
}
```

This handles different response formats:
- `{"token": "..."}`
- `{"data": {"token": "..."}}`
- `Authorization: Bearer ...` header

---

## New Features

### Health Check Endpoints

#### 1. Basic Health (`/api/health`)
- **Purpose:** Quick server status check
- **Auth Required:** No
- **Use Case:** Load balancer health check

#### 2. Detailed Health (`/api/health/detailed`)
- **Purpose:** Server + database status
- **Auth Required:** No
- **Use Case:** Monitoring dashboard
- **Returns:** 
  - Server uptime
  - Database connectivity
  - Response times
  - Memory usage

#### 3. Readiness Probe (`/api/health/ready`)
- **Purpose:** Kubernetes readiness
- **Auth Required:** No
- **Use Case:** K8s deployment
- **Returns:** 
  - `200` if ready to accept traffic
  - `503` if not ready (DB down, etc.)

#### 4. Liveness Probe (`/api/health/live`)
- **Purpose:** Kubernetes liveness
- **Auth Required:** No
- **Use Case:** K8s deployment
- **Returns:** Always `200` if process alive

#### 5. Database Metrics (`/api/health/metrics`)
- **Purpose:** Performance monitoring
- **Auth Required:** No (should add auth in production)
- **Use Case:** Performance monitoring
- **Returns:**
  - Connection pool stats
  - Active/idle connections
  - Slow query count
  - Error count

---

## Migration Checklist

### For Backend Team
- [x] Update Postman collection
- [x] Add health check endpoints
- [x] Document URL changes
- [ ] Update API documentation
- [ ] Notify frontend team
- [ ] Notify mobile team

### For Frontend Team
- [ ] Import new Postman collection
- [ ] Update API client base URLs
- [ ] Test authentication flow
- [ ] Update environment configs
- [ ] Test health check integration

### For Mobile Team
- [ ] Import new Postman collection
- [ ] Update API base URLs in app
- [ ] Change `/api/auth` to `/api/v1/auth`
- [ ] Test all API calls
- [ ] Update API client library

---

## Quick Reference

### All v1 Endpoints

**Authentication:**
```
POST /api/v1/auth/register
POST /api/v1/auth/login
```

**Public:**
```
POST /api/v1/public/inquiries
POST /api/v1/public/info/health
```

**App - Profile:**
```
POST /api/v1/app/profile/get
POST /api/v1/app/profile/update
POST /api/v1/app/profile/password
```

**App - Sync:**
```
POST /api/v1/app/sync/attendance
POST /api/v1/app/sync/gps-history
POST /api/v1/app/sync/visits
POST /api/v1/app/sync/orders
POST /api/v1/app/sync/payments
POST /api/v1/app/sync/feedback
POST /api/v1/app/sync/images
POST /api/v1/app/sync/all
POST /api/v1/app/sync/get-updates
POST /api/v1/app/sync/status
```

**Admin - Users:**
```
POST /api/v1/admin/users/list
POST /api/v1/admin/users/get
POST /api/v1/admin/users/update
POST /api/v1/admin/users/delete
```

**Admin - Inquiries:**
```
POST /api/v1/admin/inquiries/list
POST /api/v1/admin/inquiries/get
POST /api/v1/admin/inquiries/update
POST /api/v1/admin/inquiries/status
POST /api/v1/admin/inquiries/assign
POST /api/v1/admin/inquiries/delete
```

**Admin - Dashboard:**
```
POST /api/v1/admin/dashboard/stats
POST /api/v1/admin/dashboard/recent-inquiries
```

**Health (No version):**
```
GET /api/health
GET /api/health/detailed
GET /api/health/ready
GET /api/health/live
GET /api/health/metrics
```

---

## Notes

### Why Health Endpoints Have No Version

Health check endpoints are:
- Infrastructure endpoints (not business logic)
- Used by load balancers and monitoring
- Should be stable and unchanging
- Standard across all versions

### Why Auth Moved to v1

Authentication is now properly versioned to:
- Allow future v2 with different auth (OAuth, SSO)
- Maintain consistency across all endpoints
- Enable gradual migration strategies
- Follow API versioning best practices

---

## Support

### Issues?

1. **404 on auth endpoints**
   - Check using `/api/v1/auth/` not `/api/auth/`
   
2. **Token not saved automatically**
   - Check login test script is present
   - Verify response format matches expected patterns

3. **Health checks return 404**
   - Ensure health routes are mounted in app.ts
   - Check `src/routes/health.routes.ts` exists

4. **Old endpoints still being called**
   - Search codebase for `/api/auth` (without v1)
   - Update all API client configurations

---

## Changelog

### Version 2.0.0 (May 2026)
- ✅ Added v1 versioning to auth endpoints
- ✅ Added health check endpoints (5 new)
- ✅ Updated collection organization
- ✅ Improved token auto-extraction
- ✅ Added comprehensive documentation

### Version 1.0.0 (Original)
- Initial collection with mixed versioning
- Basic CRUD endpoints
- Sync endpoints

---

**Collection is now ready for production use!** 🎉

Import `Workdesk24_API_v2.postman_collection.json` to get started.
