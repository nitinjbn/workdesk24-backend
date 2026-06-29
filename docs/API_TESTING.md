# API Testing Guide

## Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# Edit .env with your database and SMTP credentials
npm install
npm run db:migrate
npm run dev
```

Server runs on: `http://localhost:3000`

---

## API Endpoints Reference

### Public Endpoints (No Auth)

#### Health Check
```bash
GET /api/v1/public/info/health
```

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-30T08:30:00.000Z",
    "uptime": 123.45
  }
}
```

#### Submit Inquiry (Rate Limited: 5/hour)
```bash
POST /api/v1/public/inquiries
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "subject": "Question about services",
  "message": "I would like to know more about your offerings."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inquiry submitted successfully",
  "data": {
    "id": 1,
    "message": "Your inquiry has been submitted successfully. We will get back to you soon."
  }
}
```

---

## Authentication Flow

### 1. Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

**Save the token** for authenticated requests.

---

## Authenticated Endpoints (App Routes)

All requests require header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Profile
```bash
GET /api/v1/app/profile
Authorization: Bearer YOUR_TOKEN
```

### Update Profile
```bash
PUT /api/v1/app/profile
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com"
}
```

### Change Password
```bash
PUT /api/v1/app/profile/password
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

---

## Admin Endpoints

All admin routes require authentication and admin privileges.

### List All Inquiries
```bash
GET /api/v1/admin/inquiries?page=1&limit=10&status=pending
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status: pending, in_progress, resolved, closed
- `priority` - Filter by priority: low, medium, high, urgent

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "inquiries": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Question",
        "message": "...",
        "status": "pending",
        "priority": "medium",
        "assignedAdmin": null,
        "createdAt": "2026-05-30T08:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

### Get Single Inquiry
```bash
GET /api/v1/admin/inquiries/1
Authorization: Bearer YOUR_TOKEN
```

### Update Inquiry Priority/Notes
```bash
PUT /api/v1/admin/inquiries/1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "priority": "high",
  "adminNotes": "Follow up required by tomorrow"
}
```

### Update Inquiry Status
```bash
PUT /api/v1/admin/inquiries/1/status
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "status": "in_progress"
}
```

**Valid statuses:** `pending`, `in_progress`, `resolved`, `closed`

### Assign Inquiry to Admin
```bash
POST /api/v1/admin/inquiries/1/assign
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "adminId": 2
}
```

### Dashboard Statistics
```bash
GET /api/v1/admin/dashboard/stats
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "inquiries": {
      "total": 150,
      "pending": 25,
      "inProgress": 40,
      "resolved": 80,
      "last30Days": 35
    },
    "users": {
      "total": 320
    }
  }
}
```

### Recent Inquiries
```bash
GET /api/v1/admin/dashboard/recent-inquiries?limit=5
Authorization: Bearer YOUR_TOKEN
```

### List All Users
```bash
GET /api/v1/admin/users?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

### Get User by ID
```bash
GET /api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN
```

### Update User
```bash
PUT /api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "newemail@example.com",
  "firstName": "Updated",
  "lastName": "Name"
}
```

### Delete User
```bash
DELETE /api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN
```

---

## Testing with cURL

### 1. Submit an Inquiry
```bash
curl -X POST http://localhost:3000/api/v1/public/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Inquiry",
    "message": "This is a test message"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

### 3. Get Profile (with token)
```bash
TOKEN="your_jwt_token_here"

curl -X GET http://localhost:3000/api/v1/app/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 4. List Inquiries (Admin)
```bash
curl -X GET "http://localhost:3000/api/v1/admin/inquiries?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing with Postman

### Setup Environment Variables
1. Create a new environment in Postman
2. Add variables:
   - `BASE_URL`: `http://localhost:3000`
   - `TOKEN`: (leave empty, will be set after login)

### Collection Structure
```
Workdesk24 API/
├── Public/
│   ├── Health Check
│   ├── Submit Inquiry
│   └── Get Version
├── Auth/
│   ├── Register
│   └── Login (save token to environment)
├── App/
│   ├── Get Profile
│   ├── Update Profile
│   └── Change Password
└── Admin/
    ├── Inquiries/
    │   ├── List Inquiries
    │   ├── Get Inquiry
    │   ├── Update Inquiry
    │   ├── Update Status
    │   └── Assign Inquiry
    ├── Users/
    │   ├── List Users
    │   ├── Get User
    │   ├── Update User
    │   └── Delete User
    └── Dashboard/
        ├── Get Stats
        └── Recent Inquiries
```

### Auto-Set Token After Login
In Login request → Tests tab:
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("TOKEN", response.data.token);
}
```

---

## Rate Limiting Tests

### Test Inquiry Rate Limit (5/hour)
```bash
# Submit 6 inquiries rapidly - 6th should be rejected
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/public/inquiries \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Test $i\",
      \"email\": \"test$i@example.com\",
      \"subject\": \"Test\",
      \"message\": \"Test message\"
    }"
  echo ""
done
```

Expected: First 5 succeed, 6th returns:
```json
{
  "message": "Too many inquiry submissions. Please try again later."
}
```

---

## Email Testing

### SMTP Configuration for Gmail

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=noreply@workdesk24.com
ADMIN_EMAIL=admin@example.com
```

### Test Email Sending
Submit an inquiry via API - two emails should be sent:
1. Admin notification to `ADMIN_EMAIL`
2. Confirmation to inquiry submitter's email

Check console logs for email status:
```
Email sent: <message-id>
```

### Using MailHog (Development Email Testing)
```bash
# Run MailHog in Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Update .env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

View emails at: http://localhost:8025

---

## Error Response Examples

### 400 Bad Request
```json
{
  "success": false,
  "message": "All required fields must be provided"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Token is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Inquiry not found"
}
```

### 429 Rate Limit
```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Database Query Testing

### View Inquiries in Database
```sql
SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 10;
```

### Check Inquiry Statistics
```sql
SELECT 
  status, 
  COUNT(*) as count 
FROM inquiries 
GROUP BY status;
```

### Find Unassigned Inquiries
```sql
SELECT * FROM inquiries WHERE assigned_to IS NULL AND status = 'pending';
```

---

## Performance Testing

### Apache Bench (Simple Load Test)
```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/api/v1/public/info/health
```

### Artillery (Advanced Load Testing)
```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - flow:
      - get:
          url: "/api/v1/public/info/health"
```

Run: `artillery run load-test.yml`

---

## Troubleshooting

### Issue: "Token is required"
**Solution:** Add Authorization header:
```
Authorization: Bearer YOUR_TOKEN
```

### Issue: "Too many requests"
**Solution:** Wait for rate limit window to reset (check `Retry-After` header)

### Issue: Email not sending
**Solution:** 
1. Check console for email errors
2. Verify SMTP credentials in `.env`
3. For Gmail: ensure App Password is used, not regular password

### Issue: Database connection error
**Solution:**
1. Verify MySQL is running
2. Check `.env` database credentials
3. Ensure database `workdesk24` exists

### Issue: Sequelize migration errors
**Solution:**
```bash
# Check migration status
npx sequelize-cli db:migrate:status

# Undo last migration if corrupted
npm run db:migrate:undo

# Re-run migrations
npm run db:migrate
```
