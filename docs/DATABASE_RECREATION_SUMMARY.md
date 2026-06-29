# Database Recreation - Complete Summary

## What Was Done

Created **11 new migration files** that will:

1. ✅ Drop all existing tables (clean slate)
2. ✅ Recreate 9 tables with correct schema
3. ✅ Seed admin user

---

## New Migration Files

### Location: `src/migrations/`

```
20260530130000-drop-all-tables.js          ⚠️  DROPS EVERYTHING
20260530130001-create-users-table.js       ✅ Users
20260530130002-create-attendance-table.js  ✅ Attendance  
20260530130003-create-gps-history-table.js ✅ GPS
20260530130004-create-visits-table.js      ✅ Visits
20260530130005-create-orders-table.js      ✅ Orders
20260530130006-create-payments-table.js    ✅ Payments
20260530130007-create-feedback-table.js    ✅ Feedback
20260530130008-create-images-table.js      ✅ Images
20260530130009-create-inquiries-table.js   ✅ Inquiries
20260530130010-seed-admin-user.js          ✅ Admin user
```

---

## Schema Compliance

### ✅ All Rules Followed:

| Rule | Status | Implementation |
|------|--------|----------------|
| camelCase columns | ✅ | userId, checkInTime, createdAt |
| BIGINT timestamps | ✅ | All date fields are BIGINT |
| Soft delete | ✅ | isDeleted, deletedAt in all tables |
| Proper indexes | ✅ | Performance indexes added |
| Foreign keys | ✅ | Relationships enforced |
| Comments | ✅ | Fields documented |

---

## Table Schemas

### 1. wd_users
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
email           VARCHAR(255) UNIQUE NOT NULL
password        VARCHAR(255) NOT NULL
name            VARCHAR(100)
role            ENUM('admin','staff','user') DEFAULT 'user'
isActive        TINYINT DEFAULT 1
lastLoginAt     BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: email, isDeleted, role
```

### 2. wd_attendance
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100) (for offline sync)
checkInTime     BIGINT NOT NULL
checkOutTime    BIGINT
checkInLat      DECIMAL(10,8)
checkInLng      DECIMAL(11,8)
checkOutLat     DECIMAL(10,8)
checkOutLng     DECIMAL(11,8)
workingHours    DECIMAL(5,2)
status          ENUM('checked_in','checked_out')
notes           TEXT
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, localId, checkInTime, status, (userId,localId) UNIQUE
```

### 3. wd_gps_history
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
latitude        DECIMAL(10,8) NOT NULL
longitude       DECIMAL(11,8) NOT NULL
accuracy        FLOAT (meters)
altitude        FLOAT
speed           FLOAT (m/s)
bearing         FLOAT (degrees)
timestamp       BIGINT NOT NULL
batteryLevel    INT (0-100)
activityType    VARCHAR(50) (still/walking/running/driving)
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, timestamp, localId, (userId,timestamp)
```

### 4. wd_visits
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
customerName    VARCHAR(200) NOT NULL
customerPhone   VARCHAR(20)
customerEmail   VARCHAR(255)
address         TEXT
latitude        DECIMAL(10,8)
longitude       DECIMAL(11,8)
visitType       ENUM('meeting','delivery','support','sales','other')
purpose         TEXT
notes           TEXT
checkInTime     BIGINT NOT NULL
checkOutTime    BIGINT
duration        INT (minutes)
status          ENUM('scheduled','in_progress','completed','cancelled')
outcome         ENUM('success','failed','rescheduled','not_available')
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, localId, checkInTime, status, visitType
```

### 5. wd_orders
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
customerName    VARCHAR(200) NOT NULL
customerPhone   VARCHAR(20)
customerEmail   VARCHAR(255)
orderNumber     VARCHAR(100) NOT NULL
orderDate       BIGINT NOT NULL
totalAmount     DECIMAL(10,2) DEFAULT 0.00
paidAmount      DECIMAL(10,2) DEFAULT 0.00
status          ENUM('pending','confirmed','processing','delivered','cancelled')
paymentStatus   ENUM('pending','partial','paid')
items           JSON (order items)
notes           TEXT
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, localId, orderNumber, orderDate, status
```

### 6. wd_payments
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
orderId         INT UNSIGNED → wd_orders.id
customerName    VARCHAR(200) NOT NULL
paymentAmount   DECIMAL(10,2) NOT NULL
paymentDate     BIGINT NOT NULL
paymentMethod   ENUM('cash','card','upi','bank_transfer','cheque','other')
transactionId   VARCHAR(100)
status          ENUM('pending','completed','failed','refunded')
notes           TEXT
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, orderId, localId, paymentDate, status, paymentMethod
```

### 7. wd_feedback
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
customerName    VARCHAR(200) NOT NULL
customerPhone   VARCHAR(20)
customerEmail   VARCHAR(255)
feedbackDate    BIGINT NOT NULL
rating          INT NOT NULL (1-5)
comments        TEXT
category        ENUM('service','product','delivery','support','other')
status          ENUM('pending','reviewed','resolved')
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, localId, feedbackDate, rating, category
```

### 8. wd_images
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
userId          INT UNSIGNED NOT NULL → wd_users.id
localId         VARCHAR(100)
fileName        VARCHAR(255) NOT NULL
filePath        VARCHAR(500) NOT NULL
fileSize        INT (bytes)
mimeType        VARCHAR(100)
entityType      VARCHAR(50) NOT NULL (visit/order/feedback/etc)
entityId        INT UNSIGNED NOT NULL
latitude        DECIMAL(10,8)
longitude       DECIMAL(11,8)
capturedAt      BIGINT
syncedAt        BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: userId, localId, (entityType,entityId)
```

### 9. wd_inquiries
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name            VARCHAR(100) NOT NULL
email           VARCHAR(255) NOT NULL
phone           VARCHAR(20)
subject         VARCHAR(200) NOT NULL
message         TEXT NOT NULL
status          ENUM('pending','in_progress','resolved','closed')
priority        ENUM('low','medium','high','urgent')
source          VARCHAR(50) (website/mobile_app/email)
ipAddress       VARCHAR(45)
userAgent       VARCHAR(500)
assignedTo      INT UNSIGNED → wd_users.id
adminNotes      TEXT
resolvedAt      BIGINT
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT

Indexes: email, status, priority, assignedTo, createdAt
```

---

## Helper Scripts

### Windows: `scripts/migrate-fresh.bat`
- Automated backup
- Run migrations
- Verify tables
- Check admin user

### Linux/Mac: `scripts/migrate-fresh.sh`
- Same as above
- Bash version

---

## How to Run Migration

### Option 1: Automated (Recommended)

```bash
# Windows
scripts\migrate-fresh.bat

# Linux/Mac
chmod +x scripts/migrate-fresh.sh
./scripts/migrate-fresh.sh
```

### Option 2: Manual

```bash
# 1. Backup
mysqldump -u root -p workdesk24 > backup.sql

# 2. Run migrations
npm run db:migrate

# 3. Verify
mysql -u root -p workdesk24 -e "SHOW TABLES;"
```

---

## Default Admin User

After migration completes:

```
Email:    admin@workdesk24.com
Password: admin123
Role:     admin
```

**⚠️ Change password immediately in production!**

```sql
-- Change password (after hashing with bcrypt)
UPDATE wd_users 
SET password = '$2a$10$NEW_HASHED_PASSWORD' 
WHERE email = 'admin@workdesk24.com';
```

---

## Verification Checklist

After migration, verify:

```bash
# Tables exist
mysql -u root -p workdesk24 -e "SHOW TABLES;" | grep wd_

# Count should be 9
mysql -u root -p workdesk24 -e "SHOW TABLES;" | grep wd_ | wc -l

# Admin user exists
mysql -u root -p workdesk24 -e "SELECT email, role FROM wd_users;"

# Check structure
mysql -u root -p workdesk24 -e "DESCRIBE wd_attendance;"

# Verify indexes
mysql -u root -p workdesk24 -e "SHOW INDEX FROM wd_users;"
```

---

## Rollback Plan

If migration fails:

```bash
# Drop database
mysql -u root -p -e "DROP DATABASE workdesk24;"

# Recreate
mysql -u root -p -e "CREATE DATABASE workdesk24;"

# Restore backup
mysql -u root -p workdesk24 < backup.sql

# Verify
mysql -u root -p workdesk24 -e "SELECT COUNT(*) FROM wd_users;"
```

---

## Breaking Changes

### 1. Timestamp Format
**OLD:** DATE (2026-05-30 13:00:00)  
**NEW:** BIGINT (1748619600)

### 2. Field Names
**OLD:** snake_case (user_id, check_in_time)  
**NEW:** camelCase (userId, checkInTime)

### 3. Soft Delete
**NEW:** All tables support soft delete via isDeleted/deletedAt

### 4. Mobile App Must Update
- Send timestamps in seconds (not milliseconds)
- Use camelCase in API requests
- Handle new response format

---

## Documentation

| File | Purpose |
|------|---------|
| **QUICK_START.md** | 3-step migration guide |
| **MIGRATION_GUIDE.md** | Complete detailed guide |
| **REFACTORING_SUMMARY.md** | All code changes |
| **DATABASE_RECREATION_SUMMARY.md** | This file |

---

## Next Steps

1. ✅ Review QUICK_START.md
2. ✅ Backup database
3. ✅ Run migration on staging
4. ✅ Test thoroughly
5. ✅ Update mobile app
6. ✅ Update Postman
7. ✅ Run on production
8. ✅ Change admin password

---

## Support

Questions? Check:
1. MIGRATION_GUIDE.md (detailed instructions)
2. QUICK_START.md (quick reference)
3. .claude/ folder (architecture rules)
4. Migration file comments

---

**Status:** ✅ Migrations created and ready to run

**Action Required:** Backup → Migrate → Test → Deploy
