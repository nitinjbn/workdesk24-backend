# Quick Start Guide - Sync API Testing

## Prerequisites
- Node.js and npm installed
- MySQL database running
- Postman installed

## Step-by-Step Setup

### 1. Environment Setup (5 minutes)

```bash
# Navigate to project directory
cd D:\Work\workdesk24

# Install dependencies (if not already done)
npm install

# Copy environment file
cp .env.example .env

# Edit .env file and configure database
# DB_HOST=localhost
# DB_USER=your_user
# DB_PASSWORD=your_password
# DB_NAME=workdesk24
# JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 2. Database Setup (2 minutes)

```bash
# Create database
mysql -u root -p
```

```sql
CREATE DATABASE workdesk24;
EXIT;
```

```bash
# Run migrations
npm run db:migrate
```

**Expected Output:**
```
Sequelize CLI [Node: xx.xx.x]

Loaded configuration file "src/config/database.js".
Using environment "development".
== 20240530000001-create-users: migrating =======
== 20240530000001-create-users: migrated (0.123s)
== 20260530081840-create-inquiries: migrating =======
== 20260530081840-create-inquiries: migrated (0.089s)
== 20260530100001-rename-tables-with-prefix: migrating =======
== 20260530100001-rename-tables-with-prefix: migrated (0.156s)
== 20260530100002-create-attendance: migrating =======
== 20260530100002-create-attendance: migrated (0.234s)
== 20260530100003-create-gps-history: migrating =======
== 20260530100003-create-gps-history: migrated (0.198s)
== 20260530100004-create-visits: migrating =======
== 20260530100004-create-visits: migrated (0.245s)
== 20260530100005-create-orders: migrating =======
== 20260530100005-create-orders: migrated (0.212s)
== 20260530100006-create-payments: migrating =======
== 20260530100006-create-payments: migrated (0.189s)
== 20260530100007-create-feedback: migrating =======
== 20260530100007-create-feedback: migrated (0.176s)
== 20260530100008-create-images: migrating =======
== 20260530100008-create-images: migrated (0.203s)
```

### 3. Verify Database Tables (1 minute)

```bash
mysql -u root -p workdesk24
```

```sql
-- Check all tables exist
SHOW TABLES;

-- Expected output:
-- +--------------------+
-- | Tables_in_workdesk24 |
-- +--------------------+
-- | SequelizeMeta      |
-- | wd_attendance      |
-- | wd_feedback        |
-- | wd_gps_history     |
-- | wd_images          |
-- | wd_inquiries       |
-- | wd_orders          |
-- | wd_payments        |
-- | wd_users           |
-- | wd_visits          |
-- +--------------------+

-- Check table structure
DESCRIBE wd_attendance;
DESCRIBE wd_gps_history;
DESCRIBE wd_visits;

EXIT;
```

### 4. Start Server (1 minute)

```bash
# Start development server
npm run dev
```

**Expected Output:**
```
> workdesk24@1.0.0 dev
> nodemon src/index.js

[nodemon] 2.x.x
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node src/index.js`
Server running on port 3000
Database connected successfully
```

### 5. Import Postman Collection (2 minutes)

1. Open Postman
2. Click **Import** button
3. Select file: `D:\Work\workdesk24\Workdesk24_API.postman_collection.json`
4. Collection imported: "Workdesk24 API v1 - Complete"

### 6. Test Basic Endpoints (5 minutes)

#### A. Health Check (No Auth Required)
```
POST http://localhost:3000/api/v1/public/info/health
Body: {}
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "API is running"
}
```

#### B. Register User (No Auth Required)
```
POST http://localhost:3000/api/auth/register
Body:
{
  "email": "testuser@example.com",
  "password": "Test@123456",
  "name": "Test User"
}
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "testuser@example.com",
    "name": "Test User"
  }
}
```

#### C. Login (No Auth Required)
```
POST http://localhost:3000/api/auth/login
Body:
{
  "email": "testuser@example.com",
  "password": "Test@123456"
}
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "testuser@example.com",
    "name": "Test User"
  }
}
```

**Important:** Copy the token value - you'll need it for all sync APIs!

In Postman, the token is automatically saved to `{{TOKEN}}` variable.

### 7. Test Sync APIs (10 minutes)

Now test each sync endpoint. All require authentication header:
```
Authorization: Bearer {{TOKEN}}
```

#### A. Sync Attendance

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/attendance
Headers:
  Authorization: Bearer {{TOKEN}}
  Content-Type: application/json
Body:
{
  "records": [
    {
      "localId": "att_001",
      "checkInTime": "2026-05-30T09:00:00Z",
      "checkOutTime": "2026-05-30T17:30:00Z",
      "checkInLat": 28.6139,
      "checkInLng": 77.2090,
      "checkOutLat": 28.6140,
      "checkOutLng": 77.2091,
      "workingHours": 8.5,
      "status": "checked_out",
      "notes": "Regular day"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance synced successfully",
  "data": {
    "success": [
      {
        "localId": "att_001",
        "serverId": 1
      }
    ],
    "updated": [],
    "failed": []
  }
}
```

#### B. Sync GPS History

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/gps-history
Headers:
  Authorization: Bearer {{TOKEN}}
  Content-Type: application/json
Body:
{
  "records": [
    {
      "localId": "gps_001",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "accuracy": 5.2,
      "recordedAt": "2026-05-30T09:00:00Z",
      "batteryLevel": 85,
      "activityType": "still"
    },
    {
      "localId": "gps_002",
      "latitude": 28.6145,
      "longitude": 77.2095,
      "accuracy": 8.5,
      "recordedAt": "2026-05-30T09:30:00Z",
      "batteryLevel": 84,
      "activityType": "walking"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "GPS history synced successfully",
  "data": {
    "success": [
      {
        "localId": "gps_001",
        "serverId": 1
      },
      {
        "localId": "gps_002",
        "serverId": 2
      }
    ],
    "updated": [],
    "failed": []
  }
}
```

#### C. Sync Visits

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/visits
Headers:
  Authorization: Bearer {{TOKEN}}
Body:
{
  "records": [
    {
      "localId": "visit_001",
      "customerName": "ABC Corporation",
      "customerPhone": "+919876543210",
      "address": "123 Business Park, Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "visitType": "meeting",
      "purpose": "Product demo",
      "checkInTime": "2026-05-30T10:00:00Z",
      "checkOutTime": "2026-05-30T11:30:00Z",
      "duration": 90,
      "status": "completed",
      "outcome": "success"
    }
  ]
}
```

#### D. Get Sync Status

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/status
Headers:
  Authorization: Bearer {{TOKEN}}
Body: {}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Sync status retrieved successfully",
  "data": {
    "counts": {
      "attendance": 1,
      "gpsHistory": 2,
      "visits": 1,
      "orders": 0,
      "payments": 0,
      "feedback": 0,
      "images": 0
    },
    "lastSyncTime": "2026-05-30T12:30:45.123Z"
  }
}
```

#### E. Test Update (Same localId)

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/attendance
Headers:
  Authorization: Bearer {{TOKEN}}
Body:
{
  "records": [
    {
      "localId": "att_001",
      "checkInTime": "2026-05-30T09:00:00Z",
      "checkOutTime": "2026-05-30T18:00:00Z",
      "workingHours": 9.0,
      "status": "checked_out",
      "notes": "Extended hours"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance synced successfully",
  "data": {
    "success": [],
    "updated": [
      {
        "localId": "att_001",
        "serverId": 1
      }
    ],
    "failed": []
  }
}
```

**Verify:** The record with serverId=1 should be updated, not duplicated.

#### F. Get Server Updates

**Request:**
```
POST http://localhost:3000/api/v1/app/sync/get-updates
Headers:
  Authorization: Bearer {{TOKEN}}
Body:
{
  "lastSyncTime": "2026-05-30T08:00:00Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Updates retrieved successfully",
  "data": {
    "attendance": [...],
    "gpsHistory": [...],
    "visits": [...],
    "orders": [],
    "payments": [],
    "feedback": [],
    "images": [],
    "syncTime": "2026-05-30T12:35:00.000Z"
  }
}
```

### 8. Verify Data in Database (2 minutes)

```bash
mysql -u root -p workdesk24
```

```sql
-- Check attendance records
SELECT id, user_id, local_id, check_in_time, status, synced_at 
FROM wd_attendance;

-- Check GPS history
SELECT id, user_id, local_id, latitude, longitude, recorded_at 
FROM wd_gps_history 
LIMIT 5;

-- Check visits
SELECT id, user_id, local_id, customer_name, status 
FROM wd_visits;

-- Verify user_id matches logged-in user
SELECT id, email, name FROM wd_users;

EXIT;
```

## Common Issues & Solutions

### Issue 1: Migration Fails
**Error:** `Table 'users' already exists`

**Solution:**
```bash
# Rollback migrations
npm run db:migrate:undo:all

# Re-run migrations
npm run db:migrate
```

### Issue 2: 401 Unauthorized
**Error:** `Authentication required`

**Solution:**
- Verify token is in Authorization header
- Check token format: `Bearer <token>` (note the space)
- Token might be expired, login again to get new token

### Issue 3: Token Not Auto-Saving in Postman
**Solution:**
- Go to Login request → Tests tab
- Verify the script is present
- After login, check: Environment → Hover over `{{TOKEN}}`

### Issue 4: Cannot Connect to Database
**Error:** `ER_ACCESS_DENIED_ERROR`

**Solution:**
- Check `.env` file has correct credentials
- Verify MySQL is running
- Test connection: `mysql -u root -p`

### Issue 5: Port 3000 Already in Use
**Error:** `EADDRINUSE`

**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

## Testing Checklist

Use this checklist to verify everything works:

- [ ] Database created successfully
- [ ] All migrations ran without errors
- [ ] 10 tables exist with `wd_` prefix
- [ ] Server starts without errors
- [ ] Health check endpoint works
- [ ] User registration works
- [ ] User login works and returns token
- [ ] Token auto-saves in Postman
- [ ] Sync attendance works (create)
- [ ] Sync attendance works (update with same localId)
- [ ] Sync GPS history works
- [ ] Sync visits works
- [ ] Sync status returns correct counts
- [ ] Get updates works with lastSyncTime
- [ ] Data visible in database with correct user_id
- [ ] No duplicate records on re-sync with same localId

## Next Steps After Testing

1. **Test All Sync Endpoints**
   - Orders
   - Payments
   - Feedback
   - Images
   - Bulk sync (/all)

2. **Test Error Scenarios**
   - Invalid token
   - Missing required fields
   - Invalid data types
   - Large batch sizes

3. **Performance Testing**
   - Sync 100 GPS records
   - Sync 1000 GPS records
   - Concurrent sync requests
   - Database query performance

4. **Android Integration**
   - Update API endpoints in Android app
   - Implement sync manager
   - Test localId → serverId mapping
   - Test offline sync queue

## Support & Documentation

- **API Documentation:** `SYNC_API_IMPLEMENTATION.md`
- **Project Overview:** `CLAUDE.md`
- **Complete Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Postman Collection:** All examples included

## Success Criteria

✅ You're ready to integrate with Android when:
1. All 10 sync endpoints tested successfully
2. Create and update flows work correctly
3. No duplicate records on re-sync
4. Sync status returns accurate counts
5. Get updates returns records since lastSyncTime
6. All data properly linked to authenticated user

---

**Estimated Total Time:** 30 minutes
**Difficulty:** Easy - All code ready, just configuration needed

Good luck with testing! 🚀
