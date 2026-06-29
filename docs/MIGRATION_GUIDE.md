# Database Migration Guide - Complete Table Recreation

## ⚠️ CRITICAL WARNING ⚠️

**This migration will DROP ALL TABLES and recreate them with the new schema.**

**ALL EXISTING DATA WILL BE LOST unless you backup first!**

---

## What This Migration Does

### 1. **Drops All Existing Tables**
- Removes all old tables (with snake_case columns, DATE types)
- Cleans up legacy tables

### 2. **Creates New Tables with Correct Schema**
All tables will have:
- ✅ **camelCase column names** (userId, checkInTime, etc.)
- ✅ **BIGINT timestamps** (Unix epoch in seconds)
- ✅ **Soft delete columns** (isDeleted, deletedAt)
- ✅ **Proper indexes** for performance
- ✅ **Foreign key constraints**

### 3. **Seeds Initial Data**
- Creates default admin user

---

## New Schema Overview

### All Tables Include:
```sql
id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
createdAt       BIGINT NOT NULL
updatedAt       BIGINT NOT NULL
isDeleted       TINYINT DEFAULT 0
deletedAt       BIGINT NULL
```

### Tables Created:

1. **wd_users**
   - Authentication & user management
   - Fields: email, password, name, role, isActive, lastLoginAt

2. **wd_attendance**
   - Check-in/check-out tracking
   - Fields: userId, localId, checkInTime, checkOutTime, GPS coords, status

3. **wd_gps_history**
   - GPS location tracking
   - Fields: userId, latitude, longitude, timestamp, accuracy, speed, bearing

4. **wd_visits**
   - Customer visit tracking
   - Fields: userId, customerName, visitType, checkInTime, status, outcome

5. **wd_orders**
   - Order management
   - Fields: userId, orderNumber, orderDate, totalAmount, status, items (JSON)

6. **wd_payments**
   - Payment tracking
   - Fields: userId, orderId, paymentAmount, paymentDate, paymentMethod

7. **wd_feedback**
   - Customer feedback
   - Fields: userId, customerName, rating, comments, category

8. **wd_images**
   - Image/file storage
   - Fields: userId, fileName, filePath, entityType, entityId

9. **wd_inquiries**
   - Public inquiries
   - Fields: name, email, subject, message, status, assignedTo

---

## Migration Files

Located in `src/migrations/`:

```
20260530130000-drop-all-tables.js          # Drops all tables
20260530130001-create-users-table.js       # Creates users
20260530130002-create-attendance-table.js  # Creates attendance
20260530130003-create-gps-history-table.js # Creates GPS history
20260530130004-create-visits-table.js      # Creates visits
20260530130005-create-orders-table.js      # Creates orders
20260530130006-create-payments-table.js    # Creates payments
20260530130007-create-feedback-table.js    # Creates feedback
20260530130008-create-images-table.js      # Creates images
20260530130009-create-inquiries-table.js   # Creates inquiries
20260530130010-seed-admin-user.js          # Seeds admin user
```

---

## Pre-Migration Checklist

### ✅ MUST DO:

1. **Backup Database**
   ```bash
   # Full backup
   mysqldump -u root -p workdesk24 > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
   
   # Or backup specific tables
   mysqldump -u root -p workdesk24 wd_users wd_attendance > backup_data.sql
   ```

2. **Backup Environment Variables**
   ```bash
   cp .env .env.backup
   ```

3. **Stop All Services**
   - Stop Node.js server
   - Stop any cron jobs
   - Notify users of downtime

4. **Test on Staging First**
   - Never run this on production first!
   - Verify on staging/dev environment

### ⚠️ SHOULD DO:

5. **Export Critical Data**
   ```bash
   # Export users
   mysql -u root -p workdesk24 -e "SELECT * FROM wd_users" > users_export.csv
   
   # Export attendance
   mysql -u root -p workdesk24 -e "SELECT * FROM wd_attendance" > attendance_export.csv
   ```

6. **Document Custom Configurations**
   - Note any custom columns you added
   - Document any manual data modifications

---

## Migration Steps

### Step 1: Backup (CRITICAL!)

```bash
# Create backup directory
mkdir -p backups

# Full database backup
mysqldump -u root -p workdesk24 > backups/full_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backups/
```

### Step 2: Check Database Connection

```bash
# Test connection
mysql -u root -p workdesk24 -e "SELECT 'Connection successful' as status;"
```

### Step 3: Run Migrations

```bash
# Method 1: Run all pending migrations
npm run db:migrate

# Method 2: Run specific migration
npx sequelize-cli db:migrate --to 20260530130010-seed-admin-user.js
```

### Step 4: Verify Tables Created

```bash
# Check tables
mysql -u root -p workdesk24 -e "SHOW TABLES;"

# Verify structure
mysql -u root -p workdesk24 -e "DESCRIBE wd_users;"
mysql -u root -p workdesk24 -e "DESCRIBE wd_attendance;"

# Check admin user
mysql -u root -p workdesk24 -e "SELECT id, email, name, role FROM wd_users;"
```

### Step 5: Test Application

```bash
# Build TypeScript
npm run build

# Start server
npm run dev

# Check health endpoint
curl http://localhost:3000/api/health
```

---

## Rollback Instructions

### If Migration Fails:

```bash
# Rollback all migrations
npm run db:migrate:undo:all

# Or rollback to specific point
npx sequelize-cli db:migrate:undo --to 20260530130001-create-users-table.js
```

### Restore from Backup:

```bash
# Drop database
mysql -u root -p -e "DROP DATABASE IF EXISTS workdesk24;"

# Recreate database
mysql -u root -p -e "CREATE DATABASE workdesk24;"

# Restore backup
mysql -u root -p workdesk24 < backups/full_backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
mysql -u root -p workdesk24 -e "SELECT COUNT(*) as user_count FROM wd_users;"
```

---

## Post-Migration Tasks

### 1. Verify Data Integrity

```sql
-- Check all tables have records (if migrating existing data)
SELECT 'users' as tbl, COUNT(*) as cnt FROM wd_users
UNION SELECT 'attendance', COUNT(*) FROM wd_attendance
UNION SELECT 'gps_history', COUNT(*) FROM wd_gps_history;

-- Check soft delete is working
SELECT COUNT(*) as active_users FROM wd_users WHERE isDeleted = 0;
SELECT COUNT(*) as deleted_users FROM wd_users WHERE isDeleted = 1;
```

### 2. Test Core Functionality

- [ ] Login with admin user (admin@workdesk24.com / admin123)
- [ ] Create new user via API
- [ ] Test attendance check-in/check-out
- [ ] Test GPS location sync
- [ ] Test visit creation
- [ ] Test order creation
- [ ] Test inquiry submission

### 3. Update Mobile App

**CRITICAL:** Mobile app must be updated to handle:
- BIGINT timestamps (seconds, not milliseconds)
- camelCase field names in API responses
- New field names in sync requests

### 4. Update API Documentation

- Update Postman collection
- Update API documentation
- Update field name examples

### 5. Monitor Performance

```sql
-- Check index usage
SHOW INDEX FROM wd_attendance;
SHOW INDEX FROM wd_gps_history;

-- Check query performance
EXPLAIN SELECT * FROM wd_attendance WHERE userId = 1 AND isDeleted = 0;
```

### 6. Security Tasks

```bash
# Change admin password immediately
# Via MySQL:
mysql -u root -p workdesk24

UPDATE wd_users 
SET password = '$2a$10$NEW_HASHED_PASSWORD' 
WHERE email = 'admin@workdesk24.com';
```

---

## Timestamp Conversion

### Old Format (DATE):
```javascript
// JavaScript Date
const date = new Date();
// MySQL stores as: 2026-05-30 13:45:00
```

### New Format (BIGINT):
```javascript
// Unix timestamp in seconds
const timestamp = Math.floor(Date.now() / 1000);
// MySQL stores as: 1748619900

// To convert back to Date:
const date = new Date(timestamp * 1000);
```

### Mobile App Changes Required:

```kotlin
// OLD (Kotlin/Android)
val createdAt = System.currentTimeMillis() // milliseconds

// NEW (Kotlin/Android)
val createdAt = System.currentTimeMillis() / 1000 // seconds
```

```swift
// OLD (Swift/iOS)
let createdAt = Date().timeIntervalSince1970 * 1000 // milliseconds

// NEW (Swift/iOS)
let createdAt = Date().timeIntervalSince1970 // seconds (already correct!)
```

---

## Field Name Changes

### Common Changes:

| Old (snake_case) | New (camelCase) |
|------------------|-----------------|
| user_id | userId |
| local_id | localId |
| check_in_time | checkInTime |
| check_out_time | checkOutTime |
| check_in_lat | checkInLat |
| check_in_lng | checkInLng |
| working_hours | workingHours |
| synced_at | syncedAt |
| created_at | createdAt |
| updated_at | updatedAt |
| order_date | orderDate |
| order_number | orderNumber |
| payment_date | paymentDate |
| payment_amount | paymentAmount |
| feedback_date | feedbackDate |

---

## Troubleshooting

### Problem: Migration Fails with "Table doesn't exist"

**Solution:** Some tables may not exist in your database. Modify `20260530130000-drop-all-tables.js` to skip non-existent tables.

### Problem: Foreign Key Constraint Fails

**Solution:** Ensure parent tables are created before child tables. Order is:
1. wd_users (parent)
2. All other tables (children)

### Problem: Admin user already exists

**Solution:** Skip or modify `20260530130010-seed-admin-user.js`

### Problem: Timestamps are wrong

**Solution:** Verify you're using seconds, not milliseconds:
```javascript
// CORRECT
Math.floor(Date.now() / 1000)

// WRONG
Date.now()
```

---

## Default Admin Credentials

After migration, use these credentials:

```
Email:    admin@workdesk24.com
Password: admin123
```

**⚠️ CHANGE IMMEDIATELY IN PRODUCTION!**

---

## Support Checklist

After migration is complete:

- [ ] All tables created successfully
- [ ] Admin user can login
- [ ] API endpoints responding
- [ ] Mobile app syncing correctly
- [ ] Timestamps in correct format
- [ ] Soft delete working
- [ ] Indexes created
- [ ] Foreign keys enforced
- [ ] Backup verified
- [ ] Documentation updated
- [ ] Team notified
- [ ] Admin password changed

---

## Emergency Contacts

If migration fails catastrophically:

1. **Stop all operations immediately**
2. **Do NOT run any more commands**
3. **Restore from backup** (see Rollback section)
4. **Review error logs**: `src/logs/` or console output
5. **Test on staging again**

---

## Estimated Downtime

- **Backup:** 2-10 minutes (depends on data size)
- **Migration:** 1-3 minutes (empty database)
- **Testing:** 5-15 minutes
- **Total:** 10-30 minutes

For databases with existing data: Add 50% more time.

---

## Success Criteria

Migration is successful when:

✅ All 9 tables created  
✅ All indexes created  
✅ Admin user exists  
✅ Application starts without errors  
✅ Health check endpoint responds  
✅ Login works  
✅ API returns correct format  
✅ No console errors  

---

## Next Steps After Migration

1. **Update Postman collection** with new field names
2. **Update mobile app** with new API format
3. **Test thoroughly** on staging
4. **Schedule production migration** during low-traffic period
5. **Monitor logs** for 24 hours post-migration
6. **Document lessons learned**

---

## Questions?

Review:
1. `REFACTORING_SUMMARY.md` - Overall changes
2. `.claude/database-rules.md` - Database rules
3. `src/migrations/` - Migration files
4. This guide

---

**Remember: ALWAYS backup before running migrations!**
