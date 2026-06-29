# API Versioning Refactor Plan

## Current Problem

**Current URL Structure:**
```
/api/auth          ❌ No version
/api/v1/app/*
/api/v1/admin/*
/api/v1/public/*
```

**Issues:**
1. `/auth` endpoint lacks version prefix
2. Version prefix hardcoded in routes/index.ts
3. Difficult to add v2 without code duplication
4. Folder structure `routes/v1/` exists but not properly utilized

## Recommended Structure

### Option 1: Centralized Versioning (Recommended)

**File Structure:**
```
src/routes/
  ├── index.ts           (version selector)
  ├── v1/
  │   ├── index.ts       (v1 aggregator)
  │   ├── auth.ts        (or import from modules/auth)
  │   ├── app/
  │   │   ├── index.ts
  │   │   ├── profile.ts
  │   │   └── sync.ts
  │   ├── admin/
  │   │   ├── index.ts
  │   │   ├── users.ts
  │   │   └── inquiries.ts
  │   └── public/
  │       ├── index.ts
  │       └── inquiries.ts
  └── v2/               (future version)
      └── index.ts
```

**Implementation:**

**src/routes/index.ts:**
```typescript
import { Router } from 'express';
import v1Routes from './v1';
// import v2Routes from './v2'; // Future

const router = Router();

// Version routing
router.use('/v1', v1Routes);
// router.use('/v2', v2Routes); // Future

// Health check (versionless)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    data: {
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    },
  });
});

export default router;
```

**src/routes/v1/index.ts:**
```typescript
import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import appRoutes from './app';
import adminRoutes from './admin';
import publicRoutes from './public';

const router = Router();

// V1 routes
router.use('/auth', authRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

**Result URLs:**
```
/api/v1/auth/*
/api/v1/app/*
/api/v1/admin/*
/api/v1/public/*
/api/health
```

### Option 2: Module-Level Versioning

Keep routes inside module folders:

```
src/modules/
  ├── auth/
  │   ├── routes/
  │   │   ├── v1.routes.ts
  │   │   └── v2.routes.ts (future)
  │   └── ...
  ├── staff/
  │   └── routes/
  │       ├── v1.routes.ts
  │       └── v2.routes.ts (future)
```

**src/routes/index.ts:**
```typescript
import { Router } from 'express';
import authV1Routes from '../modules/auth/routes/v1.routes';
import staffV1Routes from '../modules/staff/routes/v1.routes';
// import authV2Routes from '../modules/auth/routes/v2.routes'; // Future

const router = Router();

// V1 API
router.use('/v1/auth', authV1Routes);
router.use('/v1/staff', staffV1Routes);

// V2 API (future)
// router.use('/v2/auth', authV2Routes);
// router.use('/v2/staff', staffV2Routes);

export default router;
```

## Migration Steps for Option 1 (Recommended)

### Step 1: Update routes/index.ts
```typescript
import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

router.use('/v1', v1Routes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    data: {
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    },
  });
});

export default router;
```

### Step 2: Update routes/v1/index.ts
```typescript
import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import appRoutes from './app';
import adminRoutes from './admin';
import publicRoutes from './public';

const router = Router();

router.use('/auth', authRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

### Step 3: Test all endpoints
```bash
# Before
/api/auth/register     → /api/v1/auth/register
/api/v1/app/profile    → /api/v1/app/profile (unchanged)
/api/v1/admin/users    → /api/v1/admin/users (unchanged)
/api/v1/public/inquiries → /api/v1/public/inquiries (unchanged)
```

### Step 4: Update frontend/mobile clients
Update all API base URLs to include `/v1`.

## Future: Adding v2

When you need v2:

### Step 1: Create v2 folder
```bash
mkdir -p src/routes/v2
```

### Step 2: Create v2/index.ts
```typescript
import { Router } from 'express';
import authV2Routes from './auth';
import appV2Routes from './app';

const router = Router();

router.use('/auth', authV2Routes);
router.use('/app', appV2Routes);

export default router;
```

### Step 3: Mount v2 in routes/index.ts
```typescript
import v1Routes from './v1';
import v2Routes from './v2';

router.use('/v1', v1Routes);
router.use('/v2', v2Routes);
```

### Step 4: Gradual migration strategy
- Keep v1 running for existing clients
- New features go to v2
- Deprecated v1 endpoints return warning headers
- Eventually sunset v1

## Version Deprecation Strategy

**Add deprecation headers to v1:**
```typescript
// src/routes/v1/index.ts
router.use((req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-API-Deprecation', 'v1 will be deprecated on 2027-01-01');
  res.setHeader('X-API-Sunset', '2027-06-01');
  next();
});
```

## Best Practices

1. **Version in URL, not headers** - `/api/v1/` not `Accept: application/vnd.api.v1+json`
2. **Keep v1 running** - Don't break existing clients
3. **Version entire API** - Not individual endpoints
4. **Document changes** - Maintain CHANGELOG.md per version
5. **Semantic versioning** - Major version for breaking changes only

## Breaking Changes That Require New Version

- Removing endpoints
- Changing response structure
- Changing authentication method
- Renaming fields
- Changing data types

## Non-Breaking Changes (Same Version)

- Adding optional fields
- Adding new endpoints
- Bug fixes
- Performance improvements
- Adding optional query parameters

## Recommendation

**Use Option 1 (Centralized Versioning)** because:
- ✅ Clear version boundaries
- ✅ Easy to maintain multiple versions
- ✅ Gradual migration path
- ✅ Matches industry standard (Stripe, GitHub, Twitter APIs)
- ✅ Already have `/v1/` folder structure

**Next Steps:**
1. Refactor current routes to proper v1 structure
2. Update all API consumers (mobile app, frontend)
3. Document all v1 endpoints
4. Plan v2 features for future
