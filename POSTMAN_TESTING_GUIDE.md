# Postman Testing Guide for Workdesk24 API

## Database Setup - COMPLETED ✅

All database tables have been created and seeded with test data:

### Database Tables Created:
- `users` - User accounts with JWT authentication
- `inquiries` - Customer inquiry submissions
- `SequelizeMeta` - Sequelize migration tracking

### Test Users Created:
1. **Admin User**
   - Email: `admin@workdesk24.com`
   - Password: `password123`

2. **Regular User**
   - Email: `user@workdesk24.com`
   - Password: `password123`

## Server Configuration

- **Base URL**: `http://localhost:3001`
- **API Prefix**: `/api`
- **V1 API Prefix**: `/api/v1`
- **Email**: Disabled (SMTP credentials invalid - no email notifications will be sent)

## Authentication

The API uses JWT Bearer token authentication. After logging in, you'll receive a token that must be included in subsequent requests.

### How to Use Token in Postman:
1. Copy the `token` value from login response
2. Go to the **Authorization** tab in your request
3. Select **Bearer Token** type
4. Paste the token in the Token field

## API Endpoints Reference

### 1. Public Endpoints (No Authentication Required)

#### Health Check (Legacy)
```
GET http://localhost:3001/api/health
```
Response:
```json
{
  "status": "ok"
}
```

#### Health Check (V1)
```
GET http://localhost:3001/api/v1/public/info/health
```
Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-30T12:33:48.981Z",
    "uptime": 21.7276716
  }
}
```

#### API Version Info
```
GET http://localhost:3001/api/v1/public/info/version
```

#### Submit Inquiry (Public)
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
**Note**: Rate limited to 5 requests per hour per IP

### 2. Authentication Endpoints

#### Register New User
```
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "name": "New User"
}
```

#### Login
```
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "admin@workdesk24.com",
  "password": "password123"
}
```
Response:
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

### 3. User Management Endpoints (Requires Authentication)

#### Get All Users
```
GET http://localhost:3001/api/users
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Get User by ID
```
GET http://localhost:3001/api/users/1
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Update User
```
PUT http://localhost:3001/api/users/1
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

#### Delete User
```
DELETE http://localhost:3001/api/users/1
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4. V1 Admin Endpoints (Requires Authentication)

#### List All Users (Admin)
```
GET http://localhost:3001/api/v1/admin/users
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Get User by ID (Admin)
```
GET http://localhost:3001/api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Update User (Admin)
```
PUT http://localhost:3001/api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "Updated Admin Name",
  "email": "newemail@workdesk24.com"
}
```

#### Delete User (Admin)
```
DELETE http://localhost:3001/api/v1/admin/users/1
Authorization: Bearer YOUR_TOKEN_HERE
```

#### List All Inquiries (Admin)
```
GET http://localhost:3001/api/v1/admin/inquiries
Authorization: Bearer YOUR_TOKEN_HERE
```

Query Parameters:
- `status` - Filter by status (pending, in_progress, resolved, closed)
- `priority` - Filter by priority (low, medium, high, urgent)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

Example:
```
GET http://localhost:3001/api/v1/admin/inquiries?status=pending&priority=high&page=1&limit=20
```

#### Get Inquiry by ID (Admin)
```
GET http://localhost:3001/api/v1/admin/inquiries/1
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Update Inquiry (Admin)
```
PUT http://localhost:3001/api/v1/admin/inquiries/1
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "high",
  "adminNotes": "Following up with customer"
}
```

#### Update Inquiry Status (Admin)
```
PUT http://localhost:3001/api/v1/admin/inquiries/1/status
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "status": "resolved"
}
```

#### Assign Inquiry to Admin (Admin)
```
POST http://localhost:3001/api/v1/admin/inquiries/1/assign
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "userId": 1
}
```

#### Delete Inquiry (Admin)
```
DELETE http://localhost:3001/api/v1/admin/inquiries/1
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Dashboard Statistics (Admin)
```
GET http://localhost:3001/api/v1/admin/dashboard/stats
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Recent Inquiries (Admin)
```
GET http://localhost:3001/api/v1/admin/dashboard/recent-inquiries
Authorization: Bearer YOUR_TOKEN_HERE
```

Query Parameters:
- `limit` - Number of inquiries (default: 10)

### 5. V1 App Endpoints (Requires Authentication)

#### Get User Profile
```
GET http://localhost:3001/api/v1/app/profile
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Update User Profile
```
PUT http://localhost:3001/api/v1/app/profile
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "Updated Profile Name",
  "email": "newemail@example.com"
}
```

#### Change Password
```
PUT http://localhost:3001/api/v1/app/profile/password
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "currentPassword": "password123",
  "newPassword": "newSecurePassword456"
}
```

#### Get App Data
```
GET http://localhost:3001/api/v1/app/data
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Create App Data
```
POST http://localhost:3001/api/v1/app/data
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "key": "value",
  "data": "your app specific data"
}
```

## Rate Limiting

The API implements rate limiting on different endpoint groups:

- **Public Routes**: 100 requests per 15 minutes
- **Inquiry Submission**: 5 requests per hour per IP
- **Auth Routes**: 10 attempts per 15 minutes
- **Admin Routes**: 500 requests per 15 minutes
- **App Routes**: 300 requests per 15 minutes

## Testing Flow Recommendation

### Step 1: Test Public Endpoints
1. Test health check endpoints
2. Submit a test inquiry (remember: 5 per hour limit)

### Step 2: Test Authentication
1. Login with admin user
2. Save the JWT token
3. Try registering a new user

### Step 3: Test Authenticated Endpoints
1. Use the token from Step 2
2. Test user management endpoints
3. Test profile endpoints
4. Test inquiry management endpoints

### Step 4: Test Admin Features
1. List all inquiries
2. Update inquiry status
3. Assign inquiry to user
4. View dashboard statistics

## Common Response Formats

### Success Response (V1 API)
```json
{
  "success": true,
  "message": "Success message",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

### Authentication Error (401)
```json
{
  "error": "No token provided" 
}
```
or
```json
{
  "error": "Invalid or expired token"
}
```

## Troubleshooting

### Token Issues
- Make sure to include "Bearer " prefix before the token
- Check if token has expired (default: 7 days)
- Re-login to get a fresh token

### Rate Limit Errors
- Wait for the rate limit window to reset
- Use different endpoints if possible
- For inquiry submission, wait 1 hour between requests

### Email Notifications
- Email notifications are currently disabled due to invalid SMTP credentials
- The API will log email errors but continue processing requests
- Inquiries will still be saved to the database

## Database Schema Reference

### Users Table
- `id` (INT UNSIGNED, Primary Key)
- `email` (VARCHAR 255, Unique)
- `password` (VARCHAR 255, Hashed)
- `name` (VARCHAR 100)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### Inquiries Table
- `id` (INT, Primary Key)
- `name` (VARCHAR 100)
- `email` (VARCHAR 255)
- `phone` (VARCHAR 20)
- `subject` (VARCHAR 200)
- `message` (TEXT)
- `status` (ENUM: pending, in_progress, resolved, closed)
- `priority` (ENUM: low, medium, high, urgent)
- `ip_address` (VARCHAR 45)
- `user_agent` (VARCHAR 500)
- `assigned_to` (INT UNSIGNED, Foreign Key → users.id)
- `admin_notes` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Next Steps

1. Import the Postman collection: `Workdesk24_API.postman_collection.json`
2. Set up environment variables in Postman:
   - `base_url`: `http://localhost:3001`
   - `token`: (will be set after login)
3. Start testing with the login endpoint
4. Use the returned token for authenticated requests

## Quick Test Script

Here's a quick bash script to test the main endpoints:

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workdesk24.com","password":"password123"}' | jq -r '.token')

echo "Token: $TOKEN"

# Test authenticated endpoint
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
```

---

**Server Status**: Running on http://localhost:3001 ✅  
**Database**: Connected and seeded ✅  
**Email**: Disabled (SMTP credentials invalid) ⚠️
