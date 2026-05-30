# API Structure After Versioning Refactor

## Route Hierarchy

```
app.ts
  └── /api
      ├── /health (no version)
      │
      └── /v1
          ├── /auth
          │   ├── POST /register
          │   └── POST /login
          │
          ├── /app
          │   ├── GET    /profile
          │   ├── PUT    /profile
          │   ├── POST   /sync
          │   └── /data/*
          │
          ├── /admin
          │   ├── /users
          │   │   ├── GET    /
          │   │   ├── POST   /
          │   │   ├── GET    /:id
          │   │   ├── PUT    /:id
          │   │   └── DELETE /:id
          │   ├── /inquiries
          │   │   ├── GET /:id
          │   │   └── PUT /:id
          │   └── /dashboard
          │
          └── /public
              ├── POST /inquiries
              └── GET  /info
```

## Full URL Examples

### Authentication
```
POST https://your-domain.com/api/v1/auth/register
POST https://your-domain.com/api/v1/auth/login
```

### App (Mobile)
```
GET  https://your-domain.com/api/v1/app/profile
PUT  https://your-domain.com/api/v1/app/profile
POST https://your-domain.com/api/v1/app/sync
GET  https://your-domain.com/api/v1/app/data/attendance
GET  https://your-domain.com/api/v1/app/data/visits
```

### Admin
```
GET    https://your-domain.com/api/v1/admin/users
POST   https://your-domain.com/api/v1/admin/users
GET    https://your-domain.com/api/v1/admin/users/123
PUT    https://your-domain.com/api/v1/admin/users/123
DELETE https://your-domain.com/api/v1/admin/users/123
GET    https://your-domain.com/api/v1/admin/inquiries
GET    https://your-domain.com/api/v1/admin/dashboard
```

### Public
```
POST https://your-domain.com/api/v1/public/inquiries
GET  https://your-domain.com/api/v1/public/info
```

### Utility
```
GET https://your-domain.com/api/health
```

## File Structure

```
src/
├── app.ts                          → app.use('/api', routes)
├── routes/
│   ├── index.ts                    → router.use('/v1', v1Routes)
│   ├── authRoutes.ts              → Legacy (not used)
│   └── v1/
│       ├── index.ts                → Aggregates all v1 routes
│       ├── app/
│       │   ├── index.ts
│       │   ├── profile.ts
│       │   └── data.ts
│       ├── admin/
│       │   ├── index.ts
│       │   ├── users.ts
│       │   ├── inquiries.ts
│       │   └── dashboard.ts
│       └── public/
│           ├── index.ts
│           ├── inquiries.ts
│           └── info.ts
└── modules/
    └── auth/
        └── routes/
            └── auth.routes.ts      → Used by v1/index.ts
```

## Future v2 Structure

When you add v2:

```
src/routes/
├── index.ts                        → Mounts both v1 and v2
├── v1/                            → Existing v1 routes
│   └── ...
└── v2/                            → NEW v2 routes
    ├── index.ts
    ├── auth/
    │   └── index.ts               → New auth with OAuth2
    ├── app/
    │   └── index.ts               → New features
    ├── admin/
    │   └── index.ts               → New admin features
    └── public/
        └── index.ts               → New public APIs
```

**Then update routes/index.ts:**
```typescript
import v1Routes from './v1';
import v2Routes from './v2';

router.use('/v1', v1Routes);
router.use('/v2', v2Routes);  // Just add this!
```

**Result:**
```
/api/v1/*  → Existing clients
/api/v2/*  → New features
```

## Version Strategy

### Breaking Changes → New Version
- Remove/rename endpoints
- Change response structure
- Change authentication method
- Remove/rename response fields
- Change required parameters

### Non-Breaking Changes → Same Version
- Add new endpoints
- Add optional parameters
- Add new optional response fields
- Bug fixes
- Performance improvements

## API Versioning Best Practices

1. ✅ **Version entire API** - Not individual endpoints
2. ✅ **Version in URL** - `/v1/` not in headers
3. ✅ **Keep old versions running** - Don't break clients
4. ✅ **Deprecation warnings** - Give clients time to migrate
5. ✅ **Clear sunset dates** - Announce when v1 will be removed
6. ✅ **Documentation per version** - Separate docs for v1 and v2

## Migration Checklist

When moving from v1 to v2:

- [ ] Create v2 routes with new features
- [ ] Test v2 thoroughly
- [ ] Add deprecation headers to v1
- [ ] Update documentation
- [ ] Notify API consumers (mobile app, web portal)
- [ ] Set sunset date (e.g., 6 months from v2 release)
- [ ] Monitor v1 usage via analytics
- [ ] Gradually migrate clients to v2
- [ ] Sunset v1 after migration period

---

**Clean, maintainable, and future-proof API structure!** 🚀
