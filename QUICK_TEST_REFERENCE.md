# Quick Test Reference Card

## 🚀 Server Info
- **URL**: http://localhost:3001
- **Status**: Running ✅

## 🔐 Test Credentials

### Admin User
```
Email: admin@workdesk24.com
Password: password123
```

### Regular User
```
Email: user@workdesk24.com
Password: password123
```

## 📋 Quick Test Commands

### 1. Login & Get Token
```
POST http://localhost:3001/api/auth/login

{
  "email": "admin@workdesk24.com",
  "password": "password123"
}
```
**→ Copy the `token` from response**

### 2. Test Public Health Check
```
GET http://localhost:3001/api/health
```

### 3. Submit Test Inquiry (No Auth)
```
POST http://localhost:3001/api/v1/public/inquiries

{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "5551234567",
  "subject": "Product Question",
  "message": "I'd like to know more about your services."
}
```

### 4. View All Inquiries (Admin)
```
GET http://localhost:3001/api/v1/admin/inquiries
Authorization: Bearer YOUR_TOKEN_HERE
```

### 5. Update Inquiry Status (Admin)
```
PUT http://localhost:3001/api/v1/admin/inquiries/1/status
Authorization: Bearer YOUR_TOKEN_HERE

{
  "status": "in_progress"
}
```

### 6. Assign Inquiry to Admin
```
POST http://localhost:3001/api/v1/admin/inquiries/1/assign
Authorization: Bearer YOUR_TOKEN_HERE

{
  "adminId": 1
}
```

### 7. Get Dashboard Stats (Admin)
```
GET http://localhost:3001/api/v1/admin/dashboard/stats
Authorization: Bearer YOUR_TOKEN_HERE
```

### 8. Get User Profile
```
GET http://localhost:3001/api/v1/app/profile
Authorization: Bearer YOUR_TOKEN_HERE
```

### 9. Change Password
```
PUT http://localhost:3001/api/v1/app/profile/password
Authorization: Bearer YOUR_TOKEN_HERE

{
  "currentPassword": "password123",
  "newPassword": "newPassword456"
}
```

### 10. List All Users (Admin)
```
GET http://localhost:3001/api/v1/admin/users
Authorization: Bearer YOUR_TOKEN_HERE
```

## 🎯 Status Values
- pending
- in_progress
- resolved
- closed

## 📊 Priority Values
- low
- medium
- high
- urgent

## ⚡ Rate Limits
- Public routes: 100 req/15min
- Inquiries: 5 req/hour
- Auth: 10 req/15min
- Admin: 500 req/15min
- App: 300 req/15min

## 📝 Notes
- ✅ All tables created and seeded
- ✅ 2 test users available
- ✅ 1 test inquiry in database
- ⚠️ Email notifications disabled (SMTP not configured)

## 🔧 Useful cURL Commands

### Login via cURL
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}'
```

### Get Inquiries with Token
```bash
# First get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Then use it
curl -X GET http://localhost:3001/api/v1/admin/inquiries \
  -H "Authorization: Bearer $TOKEN"
```

---

**For full documentation, see:** `POSTMAN_TESTING_GUIDE.md`
