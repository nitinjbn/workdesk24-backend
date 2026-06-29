# WorkDesk24 - Database Migration Package

## 📦 What's Included

This package contains everything needed to recreate your database with the new schema that follows all architectural rules.

---

## 📚 Documentation Files

| File | Purpose | Read This When |
|------|---------|----------------|
| **QUICK_START.md** | 3-step quick guide | You want to migrate now |
| **MIGRATION_GUIDE.md** | Complete detailed guide | You need full instructions |
| **DATABASE_RECREATION_SUMMARY.md** | Schema reference | You need table details |
| **REFACTORING_SUMMARY.md** | Code changes summary | You want to understand all changes |

---

## 🗂️ Migration Files (11 total)

### Location: `src/migrations/`

**Phase 1: Drop Everything**
- `20260530130000-drop-all-tables.js` - Drops all existing tables

**Phase 2: Create Tables (9 tables)**
- `20260530130001-create-users-table.js`
- `20260530130002-create-attendance-table.js`
- `20260530130003-create-gps-history-table.js`
- `20260530130004-create-visits-table.js`
- `20260530130005-create-orders-table.js`
- `20260530130006-create-payments-table.js`
- `20260530130007-create-feedback-table.js`
- `20260530130008-create-images-table.js`
- `20260530130009-create-inquiries-table.js`

**Phase 3: Seed Data**
- `20260530130010-seed-admin-user.js` - Creates admin user

---

## 🛠️ Helper Scripts

### Windows
```batch
scripts\migrate-fresh.bat
```

### Linux/Mac
```bash
./scripts/migrate-fresh.sh
```

Both scripts will:
1. ✅ Check MySQL connection
2. ✅ Create backup automatically
3. ✅ Run all migrations
4. ✅ Verify tables created
5. ✅ Check admin user

---

## 🚀 Quick Start (3 Steps)

### Step 1: Backup (REQUIRED!)
```bash
mysqldump -u root -p workdesk24 > backup.sql
```

### Step 2: Migrate
```bash
# Automated (recommended)
scripts\migrate-fresh.bat  # Windows
./scripts/migrate-fresh.sh # Linux/Mac

# OR Manual
npm run db:migrate
```

### Step 3: Verify
```bash
# Check tables
mysql -u root -p workdesk24 -e "SHOW TABLES;"

# Login with admin
# Email: admin@workdesk24.com
# Password: admin123
```

---

## ✅ What Gets Fixed

### Before (Old Schema):
- ❌ snake_case columns (user_id, check_in_time)
- ❌ DATE columns (2026-05-30 13:00:00)
- ❌ No soft delete
- ❌ Missing indexes
- ❌ Inconsistent naming

### After (New Schema):
- ✅ camelCase columns (userId, checkInTime)
- ✅ BIGINT timestamps (1748619600)
- ✅ Soft delete (isDeleted, deletedAt)
- ✅ Proper indexes
- ✅ Consistent naming
- ✅ Foreign key constraints
- ✅ All rules followed

---

## 📊 Database Schema

### 9 Tables Created:

1. **wd_users** - User accounts & authentication
2. **wd_attendance** - Staff check-in/check-out tracking
3. **wd_gps_history** - GPS location tracking
4. **wd_visits** - Customer visit management
5. **wd_orders** - Order management
6. **wd_payments** - Payment tracking
7. **wd_feedback** - Customer feedback
8. **wd_images** - Image/file management
9. **wd_inquiries** - Public inquiries

### All Tables Include:
```sql
id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
createdAt   BIGINT NOT NULL  -- Unix timestamp (seconds)
updatedAt   BIGINT NOT NULL  -- Unix timestamp (seconds)
isDeleted   TINYINT DEFAULT 0
deletedAt   BIGINT NULL
```

---

## 🔑 Default Credentials

After migration:
```
Email:    admin@workdesk24.com
Password: admin123
Role:     admin
```

⚠️ **CHANGE PASSWORD IMMEDIATELY IN PRODUCTION!**

---

## ⚠️ Breaking Changes

### 1. Timestamp Format Changed
```javascript
// OLD: JavaScript Date
const date = new Date();
// Stored as: 2026-05-30 13:00:00

// NEW: Unix timestamp (seconds)
const timestamp = Math.floor(Date.now() / 1000);
// Stored as: 1748619600

// Convert back: new Date(timestamp * 1000)
```

### 2. Field Names Changed
| Old (snake_case) | New (camelCase) |
|------------------|-----------------|
| user_id | userId |
| check_in_time | checkInTime |
| created_at | createdAt |
| local_id | localId |

### 3. Mobile App MUST Update
- Use seconds, not milliseconds for timestamps
- Use camelCase in API requests/responses
- Handle soft delete fields

---

## 🔄 Rollback Instructions

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

## 📋 Post-Migration Checklist

- [ ] All 9 tables created
- [ ] Admin user can login
- [ ] API health check responds
- [ ] Mobile app syncing works
- [ ] Timestamps in correct format (seconds)
- [ ] Admin password changed
- [ ] Postman collection updated
- [ ] Mobile app updated
- [ ] Team notified
- [ ] Backup verified

---

## 📖 Detailed Guides

### For Quick Migration:
👉 **Read QUICK_START.md**

### For Complete Instructions:
👉 **Read MIGRATION_GUIDE.md**

### For Schema Details:
👉 **Read DATABASE_RECREATION_SUMMARY.md**

### For Code Changes:
👉 **Read REFACTORING_SUMMARY.md**

---

## 🆘 Troubleshooting

### Problem: Migration fails with "Table doesn't exist"
**Solution:** This is expected - first migration drops tables

### Problem: "Cannot connect to database"
**Solution:** Check MySQL is running and credentials are correct

### Problem: "Admin user not created"
**Solution:** Check last migration ran successfully

### Problem: Timestamps are wrong
**Solution:** Verify using seconds, not milliseconds:
```javascript
Math.floor(Date.now() / 1000)  // ✅ Correct
Date.now()                      // ❌ Wrong
```

---

## 📞 Support

1. Check documentation files
2. Review `.claude/` rules folder
3. Check migration file comments
4. Review error logs

---

## 🎯 Production Deployment

1. ✅ Test on staging first
2. ✅ Schedule during low-traffic period
3. ✅ Notify users of downtime (15-30 min)
4. ✅ Backup production database
5. ✅ Run migration
6. ✅ Verify tables
7. ✅ Test critical endpoints
8. ✅ Monitor for 24 hours
9. ✅ Update mobile app
10. ✅ Change admin password

---

## 📊 Estimated Timeline

| Task | Time |
|------|------|
| Backup | 2-10 minutes |
| Migration | 1-3 minutes |
| Verification | 5-10 minutes |
| Testing | 10-20 minutes |
| **Total** | **20-45 minutes** |

---

## ✨ Benefits of New Schema

1. ✅ **Consistent naming** - All camelCase
2. ✅ **Better performance** - Proper indexes
3. ✅ **Data integrity** - Foreign keys
4. ✅ **Soft delete** - No data loss
5. ✅ **Unix timestamps** - Better for APIs
6. ✅ **Future-proof** - Microservice ready
7. ✅ **Rule compliant** - Follows all architecture rules

---

## 🎓 Learn More

Architecture rules defined in:
- `.claude/architecture.md`
- `.claude/api-rules.md`
- `.claude/database-rules.md`
- `.claude/security-rules.md`
- `.claude/coding-style.md`

---

## ⚡ Ready to Migrate?

1. **First time?** → Read **QUICK_START.md**
2. **Need details?** → Read **MIGRATION_GUIDE.md**
3. **Just do it!** → Run migration script

---

**Remember: ALWAYS backup before migrating!**

```bash
# Backup first!
mysqldump -u root -p workdesk24 > backup.sql

# Then migrate
npm run db:migrate
```

---

**Status:** ✅ All migration files created and ready  
**Action:** Backup → Migrate → Test → Deploy
