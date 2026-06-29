# POST-Only API Quick Reference

## 🚀 All APIs Use POST Method Only

**Base URL**: `http://localhost:3001`

---

## 🔐 Authentication

### Login
```
POST /api/auth/login
{
  "email": "admin@workdesk24.com",
  "password": "password123"
}
→ Returns: { user, token }
```

### Register
```
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

---

## 🔓 Public Endpoints

### Health Check
```
POST /api/health
Body: {} (empty)
```

### Submit Inquiry
```
POST /api/v1/public/inquiries
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question",
  "message": "Your message here"
}
```

---

## 👥 Admin - Users (Auth Required)

### List Users
```
POST /api/v1/admin/users/list
Authorization: Bearer TOKEN
{
  "page": 1,
  "limit": 10
}
```

### Get User
```
POST /api/v1/admin/users/get
{
  "id": 1
}
```

### Update User
```
POST /api/v1/admin/users/update
{
  "id": 1,
  "name": "New Name",
  "email": "new@example.com"
}
```

### Delete User
```
POST /api/v1/admin/users/delete
{
  "id": 2
}
```

---

## 📋 Admin - Inquiries (Auth Required)

### List Inquiries
```
POST /api/v1/admin/inquiries/list
{
  "page": 1,
  "limit": 10,
  "status": "pending",
  "priority": "high"
}
```

### Get Inquiry
```
POST /api/v1/admin/inquiries/get
{
  "id": 1
}
```

### Update Inquiry
```
POST /api/v1/admin/inquiries/update
{
  "id": 1,
  "priority": "high",
  "adminNotes": "Notes here"
}
```

### Update Status
```
POST /api/v1/admin/inquiries/status
{
  "id": 1,
  "status": "in_progress"
}
```

### Assign Inquiry
```
POST /api/v1/admin/inquiries/assign
{
  "id": 1,
  "adminId": 1
}
```

### Delete Inquiry
```
POST /api/v1/admin/inquiries/delete
{
  "id": 1
}
```

---

## 📊 Admin - Dashboard (Auth Required)

### Get Stats
```
POST /api/v1/admin/dashboard/stats
Body: {} (empty)
```

### Recent Inquiries
```
POST /api/v1/admin/dashboard/recent-inquiries
{
  "limit": 5
}
```

---

## 👤 User Profile (Auth Required)

### Get Profile
```
POST /api/v1/app/profile/get
Body: {} (empty)
```

### Update Profile
```
POST /api/v1/app/profile/update
{
  "name": "New Name",
  "email": "new@example.com"
}
```

### Change Password
```
POST /api/v1/app/profile/password
{
  "currentPassword": "old123",
  "newPassword": "new456"
}
```

---

## 📦 App Data (Auth Required)

### Get Data
```
POST /api/v1/app/data/get
Body: {} (empty)
```

### Create Data
```
POST /api/v1/app/data/create
{
  "key": "value",
  "data": "anything"
}
```

---

## 📝 Test Credentials

```
Admin:
- Email: admin@workdesk24.com
- Password: password123

User:
- Email: user@workdesk24.com
- Password: password123
```

---

## 🎯 Enum Values

**Status**: `pending`, `in_progress`, `resolved`, `closed`  
**Priority**: `low`, `medium`, `high`, `urgent`

---

## 💡 Key Points

✅ **All endpoints use POST**  
✅ **All parameters in request body (JSON)**  
✅ **No URL parameters or query strings**  
✅ **Auth: Bearer token in Authorization header**  
✅ **Content-Type: application/json**

---

## 🔧 cURL Example

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Use token
curl -X POST http://localhost:3001/api/v1/admin/inquiries/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":10}'
```

---

**Full Documentation**: See `POST_ONLY_API_GUIDE.md`
