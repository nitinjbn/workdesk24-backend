# Quick Fix: Enable Proper API Versioning

## Current Problem
```
/api/auth          ❌ No version
/api/v1/app/*      ✅ Has version (but hardcoded wrong)
/api/v1/admin/*    ✅ Has version
/api/v1/public/*   ✅ Has version
```

## Quick Fix (2 File Changes)

### File 1: src/routes/index.ts

**REPLACE:**
```typescript
import { Router } from 'express';
import authRoutes from '../modules/auth/routes/auth.routes';
import appRoutes from './v1/app';
import adminRoutes from './v1/admin';
import publicRoutes from './v1/public';

const router = Router();

router.use('/auth', authRoutes);
router.use('/v1/app', appRoutes);
router.use('/v1/admin', adminRoutes);
router.use('/v1/public', publicRoutes);

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

**WITH:**
```typescript
import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

// All versioned routes under /v1
router.use('/v1', v1Routes);

// Health check (no version)
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

### File 2: src/routes/v1/index.ts

**REPLACE:**
```typescript
import { Router } from 'express';
import publicRoutes from './public';
import appRoutes from './app';
import adminRoutes from './admin';

const router = Router();

router.use('/public', publicRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);

export default router;
```

**WITH:**
```typescript
import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import publicRoutes from './public';
import appRoutes from './app';
import adminRoutes from './admin';

const router = Router();

// All v1 API routes
router.use('/auth', authRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

## Result

**All endpoints now properly versioned:**
```
/api/v1/auth/register
/api/v1/auth/login
/api/v1/app/profile
/api/v1/app/sync
/api/v1/admin/users
/api/v1/admin/inquiries
/api/v1/public/inquiries
/api/health               (no version - utility endpoint)
```

## Future: Adding v2 (Easy Now!)

### Step 1: Create v2 folder
```bash
mkdir -p src/routes/v2/app
mkdir -p src/routes/v2/admin
mkdir -p src/routes/v2/public
```

### Step 2: Create src/routes/v2/index.ts
```typescript
import { Router } from 'express';
import authV2Routes from './auth';  // New v2 auth logic
import appRoutes from './app';
import adminRoutes from './admin';
import publicRoutes from './public';

const router = Router();

router.use('/auth', authV2Routes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

### Step 3: Mount v2 in src/routes/index.ts
```typescript
import v1Routes from './v1';
import v2Routes from './v2';

router.use('/v1', v1Routes);
router.use('/v2', v2Routes);  // Add this line
```

**That's it! Now you have:**
```
/api/v1/*  (existing clients)
/api/v2/*  (new features)
```

## Migration Path for Clients

**Mobile App:**
```kotlin
// Old (will break after refactor)
const val BASE_URL = "https://api.example.com/api/"

// New (update to)
const val BASE_URL = "https://api.example.com/api/v1/"
```

**Frontend:**
```javascript
// Old
const API_BASE = '/api/auth/login'

// New
const API_BASE = '/api/v1/auth/login'
```

## Breaking Change Notice

⚠️ **This refactor will break existing API consumers** because:
- `/api/auth/*` moves to `/api/v1/auth/*`

**You must update:**
1. Mobile app API base URL
2. Frontend API base URL
3. Any external integrations
4. API documentation

**Alternative: Temporary Backward Compatibility**

If you can't update clients immediately, add this to `routes/index.ts`:

```typescript
// Temporary: Redirect old /auth to /v1/auth
import authRoutes from '../modules/auth/routes/auth.routes';
router.use('/auth', (req, res, next) => {
  console.warn('DEPRECATED: /api/auth is deprecated, use /api/v1/auth');
  res.setHeader('X-API-Deprecated', 'Use /api/v1/auth instead');
  next();
}, authRoutes);

// New proper versioned routes
router.use('/v1', v1Routes);
```

Then gradually migrate and remove the `/auth` redirect.
