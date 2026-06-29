# API Quick Reference - Workdesk24 v3
**All 34 Endpoints - 100% Working** ✅

---

## 🏥 Health & Monitoring (No Auth)

```bash
GET  /api/health                    # Basic health
GET  /api/health/detailed           # Detailed + DB status
GET  /api/health/ready              # K8s readiness
GET  /api/health/live               # K8s liveness
GET  /api/health/metrics            # DB metrics
```

---

## 🔐 Authentication (No Auth Required)

```bash
POST /api/v1/auth/register          # Register user
POST /api/v1/auth/login             # Login (returns JWT)
```

**Request Body (Login):**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## 🌐 Public APIs (No Auth)

```bash
POST /api/v1/public/inquiries       # Submit inquiry ✨ FIXED
POST /api/v1/public/info/health     # API health info ✨ FIXED
```

**Request Body (Inquiry):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "subject": "Question",
  "message": "Your message here"
}
```

---

## 📱 App APIs - Profile (Auth Required)

```bash
POST /api/v1/app/profile/get        # Get profile
POST /api/v1/app/profile/update     # Update profile
POST /api/v1/app/profile/password   # Change password
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 📱 App APIs - Sync (Auth Required)

```bash
POST /api/v1/app/sync/attendance    # Sync attendance
POST /api/v1/app/sync/gps-history   # Sync GPS data
POST /api/v1/app/sync/visits        # Sync visits
POST /api/v1/app/sync/orders        # Sync orders
POST /api/v1/app/sync/payments      # Sync payments
POST /api/v1/app/sync/feedback      # Sync feedback
POST /api/v1/app/sync/images        # Sync images
POST /api/v1/app/sync/all           # Sync all data
POST /api/v1/app/sync/get-updates   # Get server updates ✨ FIXED
POST /api/v1/app/sync/status        # Get sync status
```

---

## 👥 Admin APIs - Users (Admin Auth Required)

```bash
POST /api/v1/admin/users/list       # List users
POST /api/v1/admin/users/get        # Get user by ID
POST /api/v1/admin/users/update     # Update user
POST /api/v1/admin/users/delete     # Delete user
```

**Request Body (List):**
```json
{
  "page": 1,
  "limit": 10
}
```

---

## 📋 Admin APIs - Inquiries (Admin Auth Required)

```bash
POST /api/v1/admin/inquiries/list   # List inquiries
POST /api/v1/admin/inquiries/get    # Get inquiry by ID
POST /api/v1/admin/inquiries/update # Update inquiry ✨ NEW
POST /api/v1/admin/inquiries/status # Update status ✨ FIXED
POST /api/v1/admin/inquiries/assign # Assign to admin ✨ NEW
POST /api/v1/admin/inquiries/delete # Delete inquiry ✨ NEW
```

**Request Bodies:**
```json
// Update
{
  "id": 1,
  "priority": "urgent",
  "adminNotes": "Follow up required"
}

// Status
{
  "id": 1,
  "status": "in_progress"
}

// Assign
{
  "id": 1,
  "adminId": 2
}

// Delete
{
  "id": 1
}
```

---

## 📊 Admin APIs - Dashboard (Admin Auth Required)

```bash
POST /api/v1/admin/dashboard/stats              # Dashboard stats ✨ FIXED
POST /api/v1/admin/dashboard/recent-inquiries   # Recent inquiries ✨ NEW
```

**Request Body (Recent Inquiries):**
```json
{
  "limit": 5
}
```

**Response (Stats):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalInquiries": 45,
    "pendingInquiries": 12,
    "resolvedInquiries": 30,
    "inProgressInquiries": 3
  }
}
```

---

## 🔑 Authentication Flow

### 1. Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### 2. Save Token from Response
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Use Token in Subsequent Requests
```bash
curl -X POST http://localhost:3000/api/v1/app/profile/get \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 📝 Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data retrieved |
| 201 | Created | Inquiry submitted |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Invalid/missing token |
| 403 | Forbidden | Not admin |
| 404 | Not Found | User/Inquiry not found |
| 500 | Server Error | Database error |
| 503 | Service Unavailable | DB not connected |

---

## 🎯 What's Fixed (v3.0.0)

| Endpoint | Issue | Status |
|----------|-------|--------|
| `/api/health/*` | Not registered | ✅ Fixed |
| `/api/v1/public/inquiries` | Wrong path | ✅ Fixed |
| `/api/v1/public/info/health` | Wrong path | ✅ Fixed |
| `/api/v1/app/sync/get-updates` | Wrong path | ✅ Fixed |
| `/api/v1/admin/inquiries/update` | Missing | ✅ Added |
| `/api/v1/admin/inquiries/status` | Wrong path | ✅ Fixed |
| `/api/v1/admin/inquiries/assign` | Missing | ✅ Added |
| `/api/v1/admin/inquiries/delete` | Missing | ✅ Added |
| `/api/v1/admin/dashboard/stats` | Stub only | ✅ Fixed |
| `/api/v1/admin/dashboard/recent-inquiries` | Missing | ✅ Added |

---

## 🧪 Quick Test Commands

### Test Health
```bash
curl http://localhost:3000/api/health
```

### Test Public Inquiry
```bash
curl -X POST http://localhost:3000/api/v1/public/inquiries \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","subject":"Test","message":"Test"}'
```

### Test With Auth
```bash
# 1. Login and get token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.token')

# 2. Use token
curl -X POST http://localhost:3000/api/v1/app/profile/get \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 📦 Standard Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Optional error details"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved",
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
}
```

---

## 🔍 Inquiry Status Values

- `pending` - New inquiry
- `in_progress` - Being handled
- `resolved` - Completed
- `rejected` - Rejected/Spam

## 🎚️ Priority Values

- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Urgent/Critical

---

## 📚 Related Documents

- `API_VALIDATION_REPORT.md` - Detailed validation report
- `API_FIXES_APPLIED.md` - Complete list of fixes
- `DEPLOYMENT_CHECKLIST.md` - Deployment guide
- `Workdesk24_API_v3.postman_collection.json` - Postman collection

---

**Version:** 3.0.0  
**Last Updated:** 2026-05-30  
**Status:** ✅ All 34 endpoints working (100%)
