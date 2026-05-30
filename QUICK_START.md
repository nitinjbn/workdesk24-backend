# Quick Start Guide - Database Recreation

## ⚠️ READ THIS FIRST ⚠️

**This will DROP and RECREATE all database tables!**  
**ALL existing data will be LOST!**

---

## Quick Migration (3 Steps)

### Step 1: Backup (REQUIRED!)

```bash
# Windows (Command Prompt)
mysqldump -u root -p workdesk24 > backup.sql

# Linux/Mac
mysqldump -u root -p workdesk24 > backup_$(date +%Y%m%d).sql
```

### Step 2: Run Migration

**Option A: Automated Script (Recommended)**

```bash
# Windows
scripts\migrate-fresh.bat

# Linux/Mac
./scripts/migrate-fresh.sh
```

**Option B: Manual**

```bash
npm run db:migrate
```

### Step 3: Test

```bash
# Start server
npm run dev

# Test health endpoint
curl http://localhost:3000/api/health

# Login with admin
# Email: admin@workdesk24.com
# Password: admin123
```

---

## What Gets Created

### 9 Tables (All with camelCase, BIGINT timestamps, soft delete):

1. **wd_users** - User accounts
2. **wd_attendance** - Check-in/check-out
3. **wd_gps_history** - GPS tracking
4. **wd_visits** - Customer visits
5. **wd_orders** - Orders
6. **wd_payments** - Payments
7. **wd_feedback** - Feedback
8. **wd_images** - Images/files
9. **wd_inquiries** - Public inquiries

### Default Admin User:
```
Email: admin@workdesk24.com
Password: admin123
⚠️ CHANGE THIS IN PRODUCTION!
```

---

## Verify Success

```bash
# Check tables exist
mysql -u root -p workdesk24 -e "SHOW TABLES;"

# Should see 9 wd_* tables
```

---

## If Something Goes Wrong

### Restore from Backup:

```bash
# Drop database
mysql -u root -p -e "DROP DATABASE workdesk24;"

# Recreate
mysql -u root -p -e "CREATE DATABASE workdesk24;"

# Restore
mysql -u root -p workdesk24 < backup.sql
```

---

## Next Steps

1. ✅ Change admin password
2. ✅ Update mobile app (new timestamp format)
3. ✅ Update Postman collection
4. ✅ Test all APIs
5. ✅ Deploy changes

---

## Key Changes from Old Schema

### Field Names:
- `user_id` → `userId`
- `check_in_time` → `checkInTime`
- `created_at` → `createdAt`

### Timestamps:
- **OLD:** MySQL DATE format
- **NEW:** BIGINT Unix timestamp (seconds)

```javascript
// Generate timestamp
const timestamp = Math.floor(Date.now() / 1000);

// Convert back to Date
const date = new Date(timestamp * 1000);
```

### Soft Delete:
All tables now have:
- `isDeleted` (0 or 1)
- `deletedAt` (BIGINT or NULL)

---

## Full Documentation

- **MIGRATION_GUIDE.md** - Complete migration instructions
- **REFACTORING_SUMMARY.md** - All code changes
- **.claude/** - Architecture rules

---

## Support

If migration fails:
1. **STOP** - Don't run more commands
2. **Restore** from backup
3. **Review** error messages
4. **Check** MIGRATION_GUIDE.md

---

**Remember: Backup first, test on staging, then production!**
