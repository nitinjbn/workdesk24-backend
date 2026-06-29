# Workdesk24 API Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Android Application                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ SQLite DB    │  │ Sync Manager │  │ API Client (Retrofit)    │  │
│  │ - local_id   │→→│ - Queue      │→→│ - JWT Auth               │  │
│  │ - server_id  │  │ - Retry      │  │ - POST requests          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                ↓↑ HTTPS/JSON
┌─────────────────────────────────────────────────────────────────────┐
│                        Express.js REST API                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Layer                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ CORS         │→→│ Body Parser  │→→│ Rate Limiter     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐│   │
│  │  │         JWT Authentication Middleware                    ││   │
│  │  │  - Verify token                                          ││   │
│  │  │  - Extract userId                                        ││   │
│  │  │  - Attach req.user                                       ││   │
│  │  └──────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Routes Layer                             │   │
│  │  /api/auth           → authRoutes                             │   │
│  │  /api/v1/public      → publicRoutes (no auth)                │   │
│  │  /api/v1/app         → appRoutes (auth required)             │   │
│  │    ├─ /profile       → profileRoutes                         │   │
│  │    ├─ /data          → dataRoutes                            │   │
│  │    └─ /sync          → syncRoutes ⭐ NEW                      │   │
│  │  /api/v1/admin       → adminRoutes (auth required)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Controllers Layer                           │   │
│  │  ┌────────────────┐    ┌─────────────────────────────────┐   │   │
│  │  │ authController │    │ syncController ⭐ NEW           │   │   │
│  │  │ - register     │    │ - syncAttendance()             │   │   │
│  │  │ - login        │    │ - syncGpsHistory()             │   │   │
│  │  └────────────────┘    │ - syncVisits()                 │   │   │
│  │                        │ - syncOrders()                 │   │   │
│  │  ┌────────────────┐    │ - syncPayments()               │   │   │
│  │  │ adminController│    │ - syncFeedback()               │   │   │
│  │  │ - users        │    │ - syncImages()                 │   │   │
│  │  │ - inquiries    │    │ - syncAll()                    │   │   │
│  │  │ - dashboard    │    │ - getUpdates()                 │   │   │
│  │  └────────────────┘    │ - getSyncStatus()              │   │   │
│  │                        └─────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Services Layer                             │   │
│  │  ┌────────────────┐    ┌─────────────────────────────────┐   │   │
│  │  │ authService    │    │ syncService ⭐ NEW              │   │   │
│  │  │ - hashPassword │    │ - syncData() [generic]         │   │   │
│  │  │ - generateToken│    │ - syncAttendance()             │   │   │
│  │  └────────────────┘    │ - syncGpsHistory()             │   │   │
│  │                        │ - syncVisits()                 │   │   │
│  │  ┌────────────────┐    │ - syncOrders()                 │   │   │
│  │  │ emailService   │    │ - syncPayments()               │   │   │
│  │  │ - sendInquiry  │    │ - syncFeedback()               │   │   │
│  │  └────────────────┘    │ - syncImages()                 │   │   │
│  │                        │ - syncAll()                    │   │   │
│  │                        │ - getUpdates()                 │   │   │
│  │                        │ - getSyncStatus()              │   │   │
│  │                        └─────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Models Layer (Sequelize ORM)               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ User       │  │ Inquiry    │  │ Attendance │ ⭐ NEW      │   │
│  │  │ wd_users   │  │ wd_inquiries│ │ wd_attendance│            │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ GpsHistory │  │ Visit      │  │ Order      │ ⭐ NEW      │   │
│  │  │ wd_gps_... │  │ wd_visits  │  │ wd_orders  │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ Payment    │  │ Feedback   │  │ Image      │ ⭐ NEW      │   │
│  │  │ wd_payments│  │ wd_feedback│  │ wd_images  │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                ↓↑
┌─────────────────────────────────────────────────────────────────────┐
│                         MySQL Database                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Tables with wd_ prefix:                                       │   │
│  │  • wd_users          - User accounts                          │   │
│  │  • wd_inquiries      - Customer inquiries                     │   │
│  │  • wd_attendance     - Attendance records ⭐                  │   │
│  │  • wd_gps_history    - GPS location tracking ⭐               │   │
│  │  • wd_visits         - Customer visits ⭐                     │   │
│  │  • wd_orders         - Sales orders ⭐                        │   │
│  │  • wd_payments       - Payment transactions ⭐                │   │
│  │  • wd_feedback       - Customer feedback ⭐                   │   │
│  │  • wd_images         - Image attachments ⭐                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Complete Implementation Summary

### ✅ What Was Implemented

**17 New Files Created:**
- 7 Models (attendance, gpsHistory, visit, order, payment, feedback, image)
- 8 Migrations (rename tables + 7 new tables)
- 1 Service (syncService)
- 1 Controller (syncController)  
- 1 Route file (sync routes)
- 4 Documentation files

**10 New API Endpoints:**
1. POST /api/v1/app/sync/attendance
2. POST /api/v1/app/sync/gps-history
3. POST /api/v1/app/sync/visits
4. POST /api/v1/app/sync/orders
5. POST /api/v1/app/sync/payments
6. POST /api/v1/app/sync/feedback
7. POST /api/v1/app/sync/images
8. POST /api/v1/app/sync/all
9. POST /api/v1/app/sync/get-updates
10. POST /api/v1/app/sync/status

**All Requirements Met:**
✅ Sync APIs for all 7 data types
✅ All tables use `wd_` prefix  
✅ All APIs validate with JWT token (except public/register/login)
✅ Postman collection updated with all latest APIs

### 📚 Documentation Created

1. **CLAUDE.md** - Updated with sync API documentation
2. **SYNC_API_IMPLEMENTATION.md** - Complete API reference guide
3. **IMPLEMENTATION_SUMMARY.md** - Detailed summary of all changes
4. **QUICK_START_GUIDE.md** - Step-by-step testing instructions
5. **ARCHITECTURE_DIAGRAM.md** - This file with visual diagrams

### 🚀 Next Steps

1. **Run Migrations:**
   ```bash
   npm run db:migrate
   ```

2. **Test with Postman:**
   - Import: `Workdesk24_API.postman_collection.json`
   - Register → Login → Get Token
   - Test all sync endpoints

3. **Integrate with Android:**
   - Update API endpoints
   - Implement sync manager
   - Store localId → serverId mappings

### 📞 Support Documents

- Quick testing: `QUICK_START_GUIDE.md`
- API details: `SYNC_API_IMPLEMENTATION.md`
- Full summary: `IMPLEMENTATION_SUMMARY.md`
- Project info: `CLAUDE.md`

---

**Status:** 100% Complete and Ready for Testing
**Date:** 2026-05-30
