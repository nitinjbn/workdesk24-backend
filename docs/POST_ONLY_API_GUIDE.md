# POST-Only API Guide for Workdesk24

## Overview

**All API endpoints now use POST requests only.** Parameters that were previously sent via URL params or query strings are now sent in the request body as JSON.

## Server Configuration

- **Base URL**: `http://localhost:3001`
- **All Requests**: POST method
- **Content-Type**: `application/json`
- **Authentication**: Bearer token in Authorization header

## Test Credentials

```json
Admin User:
{
  "email": "admin@workdesk24.com",
  "password": "password123"
}

Regular User:
{
  "email": "user@workdesk24.com",
  "password": "password123"
}
```

---

## API Endpoints Reference

### 🔓 Public Endpoints (No Authentication)

#### 1. Health Check (Legacy)
```
POST http://localhost:3001/api/health
Body: {} (empty or no body)
```
**Response:**
```json
{"status": "ok"}
```

#### 2. Health Check (V1)
```
POST http://localhost:3001/api/v1/public/info/health
Body: {} (empty or no body)
```
**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-30T12:56:08.966Z",
    "uptime": 7.6770192
  }
}
```

#### 3. API Version Info
```
POST http://localhost:3001/api/v1/public/info/version
Body: {} (empty or no body)
```

#### 4. Submit Inquiry
```
POST http://localhost:3001/api/v1/public/inquiries
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "subject": "Need help with product",
  "message": "I have a question about your services..."
}
```
**Rate Limited**: 5 requests per hour per IP

---

### 🔐 Authentication Endpoints

#### 1. Register New User
```
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "name": "New User"
}
```

#### 2. Login
```
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "admin@workdesk24.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "admin@workdesk24.com",
    "name": "Admin User",
    "createdAt": "2026-05-30T12:31:57.000Z",
    "updatedAt": "2026-05-30T12:31:57.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 👤 User Profile Endpoints (Requires Authentication)

#### 1. Get My Profile
```
POST http://localhost:3001/api/users/me
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
Body: {} (empty or no body)
```

---

### 👥 Admin User Management (Requires Authentication)

#### 1. List All Users
```
POST http://localhost:3001/api/v1/admin/users/list
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "page": 1,
  "limit": 10
}
```
**Body Parameters** (all optional):
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

#### 2. Get User by ID
```
POST http://localhost:3001/api/v1/admin/users/get
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1
}
```
**Body Parameters** (required):
- `id` - User ID

#### 3. Update User
```
POST http://localhost:3001/api/v1/admin/users/update
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1,
  "name": "Updated Name",
  "email": "updated@example.com"
}
```
**Body Parameters**:
- `id` (required) - User ID
- `name` (optional) - User's full name
- `email` (optional) - User's email

#### 4. Delete User
```
POST http://localhost:3001/api/v1/admin/users/delete
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 2
}
```
**Body Parameters** (required):
- `id` - User ID to delete

---

### 📋 Admin Inquiry Management (Requires Authentication)

#### 1. List All Inquiries
```
POST http://localhost:3001/api/v1/admin/inquiries/list
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "page": 1,
  "limit": 10,
  "status": "pending",
  "priority": "high"
}
```
**Body Parameters** (all optional):
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status (pending, in_progress, resolved, closed)
- `priority` - Filter by priority (low, medium, high, urgent)

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "inquiries": [...],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

#### 2. Get Inquiry by ID
```
POST http://localhost:3001/api/v1/admin/inquiries/get
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1
}
```
**Body Parameters** (required):
- `id` - Inquiry ID

#### 3. Update Inquiry
```
POST http://localhost:3001/api/v1/admin/inquiries/update
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1,
  "priority": "high",
  "adminNotes": "Following up with customer"
}
```
**Body Parameters**:
- `id` (required) - Inquiry ID
- `priority` (optional) - Priority level
- `adminNotes` (optional) - Admin notes

#### 4. Update Inquiry Status
```
POST http://localhost:3001/api/v1/admin/inquiries/status
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1,
  "status": "in_progress"
}
```
**Body Parameters** (required):
- `id` - Inquiry ID
- `status` - New status (pending, in_progress, resolved, closed)

#### 5. Assign Inquiry to Admin
```
POST http://localhost:3001/api/v1/admin/inquiries/assign
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1,
  "adminId": 1
}
```
**Body Parameters** (required):
- `id` - Inquiry ID
- `adminId` - Admin user ID to assign

#### 6. Delete Inquiry
```
POST http://localhost:3001/api/v1/admin/inquiries/delete
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "id": 1
}
```
**Body Parameters** (required):
- `id` - Inquiry ID to delete

---

### 📊 Admin Dashboard (Requires Authentication)

#### 1. Get Dashboard Statistics
```
POST http://localhost:3001/api/v1/admin/dashboard/stats
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
Body: {} (empty or no body)
```
**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "inquiries": {
      "total": 1,
      "pending": 1,
      "inProgress": 0,
      "resolved": 0,
      "last30Days": 1
    },
    "users": {
      "total": 2
    }
  }
}
```

#### 2. Get Recent Inquiries
```
POST http://localhost:3001/api/v1/admin/dashboard/recent-inquiries
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "limit": 5
}
```
**Body Parameters** (optional):
- `limit` - Number of inquiries to return (default: 5)

---

### 👨‍💼 App Profile Endpoints (Requires Authentication)

#### 1. Get User Profile
```
POST http://localhost:3001/api/v1/app/profile/get
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
Body: {} (empty or no body)
```

#### 2. Update User Profile
```
POST http://localhost:3001/api/v1/app/profile/update
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Updated Profile Name",
  "email": "newemail@example.com"
}
```
**Body Parameters** (optional):
- `name` - User's full name
- `email` - User's email

#### 3. Change Password
```
POST http://localhost:3001/api/v1/app/profile/password
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "currentPassword": "password123",
  "newPassword": "newSecurePassword456"
}
```
**Body Parameters** (required):
- `currentPassword` - Current password
- `newPassword` - New password (minimum 6 characters)

---

### 📦 App Data Endpoints (Requires Authentication)

#### 1. Get App Data
```
POST http://localhost:3001/api/v1/app/data/get
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
Body: {} (empty or no body)
```

#### 2. Create App Data
```
POST http://localhost:3001/api/v1/app/data/create
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "key": "value",
  "data": "your app specific data"
}
```

---

## Quick Testing Examples

### Example 1: Complete Authentication Flow

```bash
# Step 1: Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}'

# Copy the token from response

# Step 2: Use token to get inquiries
curl -X POST http://localhost:3001/api/v1/admin/inquiries/list \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":10}'
```

### Example 2: Submit and Manage Inquiry

```bash
# Step 1: Submit inquiry (no auth needed)
curl -X POST http://localhost:3001/api/v1/public/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Jane Doe",
    "email":"jane@example.com",
    "subject":"Question",
    "message":"I have a question..."
  }'

# Step 2: Login as admin
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Step 3: View all inquiries
curl -X POST http://localhost:3001/api/v1/admin/inquiries/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":10}'

# Step 4: Update inquiry status
curl -X POST http://localhost:3001/api/v1/admin/inquiries/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":1,"status":"in_progress"}'

# Step 5: Assign to admin
curl -X POST http://localhost:3001/api/v1/admin/inquiries/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":1,"adminId":1}'
```

---

## Postman Setup

### Environment Variables
Create a Postman environment with:
- `base_url`: `http://localhost:3001`
- `token`: (set this after login)

### Using Token in Postman
1. After login, copy the `token` from response
2. Go to environment and paste into `token` variable
3. For authenticated requests:
   - Authorization tab → Type: Bearer Token
   - Token: `{{token}}`

### Pre-request Script for Auto-login
Add this to collection pre-request script:
```javascript
if (!pm.environment.get("token")) {
    pm.sendRequest({
        url: pm.environment.get("base_url") + "/api/auth/login",
        method: 'POST',
        header: {'Content-Type': 'application/json'},
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                email: "admin@workdesk24.com",
                password: "password123"
            })
        }
    }, function (err, response) {
        pm.environment.set("token", response.json().token);
    });
}
```

---

## Key Differences from Standard REST

| Standard REST | This API (POST-only) |
|--------------|---------------------|
| GET /users | POST /users/list |
| GET /users/:id | POST /users/get + body: {id} |
| PUT /users/:id | POST /users/update + body: {id, ...} |
| DELETE /users/:id | POST /users/delete + body: {id} |
| GET /users?page=1 | POST /users/list + body: {page:1} |

**Benefits of POST-only approach:**
- All parameters in request body
- No URL encoding issues
- Consistent request format
- Better for complex filtering
- More secure (no sensitive data in URLs/logs)

---

## Rate Limiting

- **Public Routes**: 100 requests per 15 minutes
- **Inquiry Submission**: 5 requests per hour per IP
- **Auth Routes**: 10 attempts per 15 minutes
- **Admin Routes**: 500 requests per 15 minutes
- **App Routes**: 300 requests per 15 minutes

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

---

## Status Values
- `pending` - New inquiry
- `in_progress` - Being worked on
- `resolved` - Issue resolved
- `closed` - Inquiry closed

## Priority Values
- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
- `urgent` - Urgent priority

---

## Notes

✅ **All endpoints use POST method**  
✅ **All parameters sent in request body as JSON**  
✅ **Database tables created and seeded**  
✅ **2 test users available**  
✅ **Server running on port 3001**  
⚠️ **Email notifications disabled** (SMTP not configured)

---

**Server Status**: Running on http://localhost:3001 ✅
