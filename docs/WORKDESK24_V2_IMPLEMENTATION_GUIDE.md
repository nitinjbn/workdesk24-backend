# Workdesk24 v2 Implementation Guide

## Practical Step-by-Step Guide for Your Project

This guide shows exactly how to add v2 to your Workdesk24 project while keeping v1 working.

---

## Phase 1: Planning (Week 1)

### Step 1: Document v2 Changes

Create a document listing all breaking changes you want in v2:

**Example Changes for Workdesk24 v2:**

#### Authentication Changes
- ✅ Split `name` field into `firstName` and `lastName`
- ✅ Change `createdAt` from UNIX timestamp to ISO8601
- ✅ Include tokens in response body (v1 uses header)
- ✅ Add `emailVerified` field
- ✅ Change error format to structured errors

#### Attendance Changes
- ✅ Change field names: `checkInLat` → `location.checkIn.latitude`
- ✅ Add `accuracy` field to GPS coordinates
- ✅ Change timestamp format to ISO8601
- ✅ Add `deviceInfo` to sync requests

#### Response Format Changes
- ✅ Remove `success` wrapper from all responses
- ✅ Use consistent error format
- ✅ Add pagination metadata to list endpoints

### Step 2: Create Migration Document

**WORKDESK24_V1_TO_V2_MIGRATION.md**
```markdown
# API v1 to v2 Migration Guide

## Breaking Changes

### 1. Authentication

#### Register Endpoint
**v1:** POST /api/v1/auth/register
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**v2:** POST /api/v2/auth/register
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response Changes:**
- Tokens now in response body (not header)
- Added `emailVerified` field
- Timestamp format changed to ISO8601

### 2. Attendance Sync

**v1:** POST /api/v1/app/sync
```json
{
  "attendance": [{
    "localId": "att_123",
    "checkInTime": 1672531200,
    "checkInLat": 28.6139,
    "checkInLng": 77.2090
  }]
}
```

**v2:** POST /api/v2/app/sync
```json
{
  "batchId": "batch_uuid",
  "deviceInfo": {
    "deviceId": "device_123",
    "appVersion": "2.0.0"
  },
  "attendance": [{
    "localId": "att_123",
    "timestamps": {
      "checkIn": "2023-01-01T09:00:00Z"
    },
    "location": {
      "checkIn": {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "accuracy": 5.2
      }
    }
  }]
}
```
```

---

## Phase 2: Setup Structure (Week 2)

### Step 1: Create Directory Structure

```bash
# Create v2 route directories
mkdir -p src/routes/v2/auth
mkdir -p src/routes/v2/app
mkdir -p src/routes/v2/admin
mkdir -p src/routes/v2/public

# Create v2 DTO directories
mkdir -p src/modules/auth/dto/v1
mkdir -p src/modules/auth/dto/v2
mkdir -p src/modules/staff/dto/v1
mkdir -p src/modules/staff/dto/v2
mkdir -p src/modules/public/dto/v1
mkdir -p src/modules/public/dto/v2

# Create mapper directories
mkdir -p src/modules/auth/mappers
mkdir -p src/modules/staff/mappers
mkdir -p src/modules/public/mappers

# Create v2 controller directories (optional - can share with v1)
mkdir -p src/modules/auth/controllers
mkdir -p src/modules/staff/controllers
mkdir -p src/modules/public/controllers
```

### Step 2: Create Base Types for v2

**src/shared/types/api-response.types.ts**
```typescript
// Common response types for v2

export interface ApiResponseV2<T> {
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiErrorV2 {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export interface PaginatedResponseV2<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: {
    timestamp: string;
  };
}
```

**src/shared/types/base-dto.types.ts**
```typescript
// Base DTO types for v2

export interface TimestampV2 {
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
}

export interface LocationV2 {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}

export interface DeviceInfoV2 {
  deviceId: string;
  platform: 'android' | 'ios' | 'web';
  appVersion: string;
  osVersion?: string;
}
```

---

## Phase 3: Implement Auth v2 (Week 3)

### Step 1: Create Auth v2 DTOs

**src/modules/auth/dto/v2/register.dto.ts**
```typescript
export interface RegisterRequestV2 {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserProfileV2 {
  firstName: string;
  lastName: string;
}

export interface UserMetadataV2 {
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
  emailVerified: boolean;
  lastLoginAt?: string;  // ISO8601
}

export interface UserV2 {
  id: number;
  email: string;
  role: 'admin' | 'staff' | 'user';
  isActive: boolean;
  profile: UserProfileV2;
  metadata: UserMetadataV2;
}

export interface TokensV2 {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RegisterResponseV2 {
  user: UserV2;
  tokens: TokensV2;
}

export interface LoginRequestV2 {
  email: string;
  password: string;
}

export interface LoginResponseV2 {
  user: UserV2;
  tokens: TokensV2;
}
```

**src/modules/auth/dto/v1/register.dto.ts** (Move existing to v1)
```typescript
export interface RegisterRequestV1 {
  email: string;
  password: string;
  name: string;
}

export interface UserResponseV1 {
  success: boolean;
  message: string;
  data: {
    id: number;
    email: string;
    name: string;
    role: string;
    createdAt: number;  // UNIX timestamp
  };
}

export interface LoginRequestV1 {
  email: string;
  password: string;
}

export interface LoginResponseV1 {
  success: boolean;
  message: string;
  data: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}
```

### Step 2: Create Mappers

**src/modules/auth/mappers/v1.mapper.ts**
```typescript
import { User } from '../../../models/schemas/User';
import { UserResponseV1, RegisterRequestV1 } from '../dto/v1/register.dto';

export class AuthMapperV1 {
  static toUserResponse(user: User): UserResponseV1 {
    return {
      success: true,
      message: 'Operation successful',
      data: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'user',
        createdAt: user.createdAt,
      },
    };
  }

  static toCreateUserData(dto: RegisterRequestV1) {
    return {
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: 'user' as const,
    };
  }
}
```

**src/modules/auth/mappers/v2.mapper.ts**
```typescript
import { User } from '../../../models/schemas/User';
import {
  RegisterRequestV2,
  RegisterResponseV2,
  UserV2,
  TokensV2,
} from '../dto/v2/register.dto';

export class AuthMapperV2 {
  static toUserV2(user: User): UserV2 {
    // Split name into firstName and lastName
    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      isActive: user.isActive === 1,
      profile: {
        firstName,
        lastName,
      },
      metadata: {
        createdAt: this.toISO8601(user.createdAt),
        updatedAt: this.toISO8601(user.updatedAt),
        emailVerified: false,  // TODO: Add this field to database
        lastLoginAt: user.lastLoginAt ? this.toISO8601(user.lastLoginAt) : undefined,
      },
    };
  }

  static toRegisterResponse(
    user: User,
    accessToken: string,
    refreshToken: string
  ): RegisterResponseV2 {
    return {
      user: this.toUserV2(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
    };
  }

  static toCreateUserData(dto: RegisterRequestV2) {
    return {
      email: dto.email,
      password: dto.password,
      name: `${dto.firstName} ${dto.lastName}`.trim(),
      role: 'user' as const,
    };
  }

  private static toISO8601(unixTimestamp: number): string {
    return new Date(unixTimestamp * 1000).toISOString();
  }
}
```

### Step 3: Create v2 Controller

**src/modules/auth/controllers/v2.auth.controller.ts**
```typescript
import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { AuthMapperV2 } from '../mappers/v2.mapper';
import { RegisterRequestV2, LoginRequestV2 } from '../dto/v2/register.dto';
import { ApiErrorV2 } from '../../../shared/types/api-response.types';

export class AuthControllerV2 {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const dto: RegisterRequestV2 = req.body;

      // Validate
      if (!dto.email || !dto.password || !dto.firstName || !dto.lastName) {
        const error: ApiErrorV2 = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: {
              required: ['email', 'password', 'firstName', 'lastName'],
            },
            timestamp: new Date().toISOString(),
          },
        };
        res.status(400).json(error);
        return;
      }

      // Transform and create user
      const userData = AuthMapperV2.toCreateUserData(dto);
      const user = await authService.register(userData);

      // Login to get tokens
      const { accessToken, refreshToken } = await authService.login(
        user.email,
        dto.password
      );

      // Transform to v2 response
      const response = AuthMapperV2.toRegisterResponse(
        user,
        accessToken,
        refreshToken
      );

      res.status(201).json(response);
    } catch (error: any) {
      const apiError: ApiErrorV2 = {
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message || 'Registration failed',
          timestamp: new Date().toISOString(),
        },
      };
      res.status(400).json(apiError);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const dto: LoginRequestV2 = req.body;

      // Validate
      if (!dto.email || !dto.password) {
        const error: ApiErrorV2 = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: {
              required: ['email', 'password'],
            },
            timestamp: new Date().toISOString(),
          },
        };
        res.status(400).json(error);
        return;
      }

      // Authenticate
      const { user, accessToken, refreshToken } = await authService.login(
        dto.email,
        dto.password
      );

      // Transform to v2 response
      const response = AuthMapperV2.toRegisterResponse(
        user,
        accessToken,
        refreshToken
      );

      res.json(response);
    } catch (error: any) {
      const apiError: ApiErrorV2 = {
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message || 'Authentication failed',
          timestamp: new Date().toISOString(),
        },
      };
      res.status(401).json(apiError);
    }
  }
}

export default new AuthControllerV2();
```

### Step 4: Create v2 Routes

**src/modules/auth/routes/v2.routes.ts**
```typescript
import { Router } from 'express';
import authControllerV2 from '../controllers/v2.auth.controller';

const router = Router();

router.post('/register', authControllerV2.register.bind(authControllerV2));
router.post('/login', authControllerV2.login.bind(authControllerV2));

export default router;
```

### Step 5: Create v2 Index

**src/routes/v2/index.ts**
```typescript
import { Router } from 'express';
import authRoutesV2 from '../../modules/auth/routes/v2.routes';
// Import other v2 routes as you create them
// import appRoutesV2 from './app';
// import adminRoutesV2 from './admin';
// import publicRoutesV2 from './public';

const router = Router();

// Add deprecation info to all v2 responses
router.use((req, res, next) => {
  res.setHeader('X-API-Version', 'v2');
  res.setHeader('X-API-Status', 'stable');
  next();
});

router.use('/auth', authRoutesV2);
// router.use('/app', appRoutesV2);
// router.use('/admin', adminRoutesV2);
// router.use('/public', publicRoutesV2);

export default router;
```

### Step 6: Mount v2 in Main Routes

**src/routes/index.ts**
```typescript
import { Router } from 'express';
import v1Routes from './v1';
import v2Routes from './v2';

const router = Router();

// V1 routes (add deprecation headers)
router.use('/v1', (req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('Deprecation', 'Sun, 01 Jan 2027 00:00:00 GMT');
  res.setHeader('Link', '</api/v2>; rel="successor-version"');
  next();
}, v1Routes);

// V2 routes
router.use('/v2', v2Routes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    versions: {
      v1: {
        status: 'deprecated',
        sunsetDate: '2027-01-01',
      },
      v2: {
        status: 'stable',
      },
    },
  });
});

export default router;
```

---

## Phase 4: Test Both Versions (Week 4)

### Step 1: Create Test Scripts

**tests/auth.v1.test.sh**
```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== Testing Auth v1 ==="

echo "\n1. Register v1"
curl -X POST "$BASE_URL/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testv1@example.com",
    "password": "password123",
    "name": "Test User V1"
  }'

echo "\n\n2. Login v1"
curl -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testv1@example.com",
    "password": "password123"
  }'
```

**tests/auth.v2.test.sh**
```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== Testing Auth v2 ==="

echo "\n1. Register v2"
curl -X POST "$BASE_URL/v2/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testv2@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User V2"
  }'

echo "\n\n2. Login v2"
curl -X POST "$BASE_URL/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testv2@example.com",
    "password": "password123"
  }'
```

### Step 2: Run Tests

```bash
# Make scripts executable
chmod +x tests/auth.v1.test.sh
chmod +x tests/auth.v2.test.sh

# Start server
npm run dev

# In another terminal, run tests
./tests/auth.v1.test.sh
./tests/auth.v2.test.sh
```

---

## Phase 5: Update Clients (Week 5-6)

### Android App Updates

**Before (v1):**
```kotlin
// ApiService.kt
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

data class UserResponse(
    val success: Boolean,
    val message: String,
    val data: UserData
)

data class UserData(
    val id: Int,
    val email: String,
    val name: String,
    val createdAt: Long
)
```

**After (v2):**
```kotlin
// ApiService.kt
data class RegisterRequestV2(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String
)

data class RegisterResponseV2(
    val user: UserV2,
    val tokens: TokensV2
)

data class UserV2(
    val id: Int,
    val email: String,
    val role: String,
    val isActive: Boolean,
    val profile: ProfileV2,
    val metadata: MetadataV2
)

data class ProfileV2(
    val firstName: String,
    val lastName: String
)

data class MetadataV2(
    val createdAt: String,  // ISO8601
    val updatedAt: String,
    val emailVerified: Boolean,
    val lastLoginAt: String?
)

data class TokensV2(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val tokenType: String
)
```

**API Config:**
```kotlin
// ApiConfig.kt
object ApiConfig {
    const val BASE_URL_V1 = "https://api.workdesk24.com/api/v1/"
    const val BASE_URL_V2 = "https://api.workdesk24.com/api/v2/"
    
    // Use feature flag to switch versions
    val BASE_URL = if (BuildConfig.USE_API_V2) BASE_URL_V2 else BASE_URL_V1
}
```

### Next.js Web Portal Updates

**Before (v1):**
```typescript
// lib/api/auth.ts
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface UserResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    email: string;
    name: string;
    createdAt: number;
  };
}
```

**After (v2):**
```typescript
// lib/api/v2/auth.ts
interface RegisterRequestV2 {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface RegisterResponseV2 {
  user: UserV2;
  tokens: TokensV2;
}

interface UserV2 {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  profile: {
    firstName: string;
    lastName: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    emailVerified: boolean;
    lastLoginAt?: string;
  };
}

interface TokensV2 {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
```

---

## Phase 6: Monitor & Migrate (Weeks 7-20)

### Step 1: Add Usage Tracking

**src/shared/middleware/version-analytics.middleware.ts**
```typescript
import { Request, Response, NextFunction } from 'express';

interface VersionStats {
  version: string;
  endpoint: string;
  count: number;
  lastUsed: string;
}

const versionStats = new Map<string, VersionStats>();

export const versionAnalytics = (req: Request, res: Response, next: NextFunction) => {
  const version = req.path.includes('/v2/') ? 'v2' : 'v1';
  const endpoint = req.path;
  const key = `${version}:${endpoint}`;
  
  const existing = versionStats.get(key);
  if (existing) {
    existing.count++;
    existing.lastUsed = new Date().toISOString();
  } else {
    versionStats.set(key, {
      version,
      endpoint,
      count: 1,
      lastUsed: new Date().toISOString(),
    });
  }
  
  next();
};

// Endpoint to view stats
export const getVersionStats = (req: Request, res: Response) => {
  const stats = Array.from(versionStats.values());
  
  const v1Stats = stats.filter(s => s.version === 'v1');
  const v2Stats = stats.filter(s => s.version === 'v2');
  
  const v1Total = v1Stats.reduce((sum, s) => sum + s.count, 0);
  const v2Total = v2Stats.reduce((sum, s) => sum + s.count, 0);
  
  res.json({
    summary: {
      v1: {
        requests: v1Total,
        endpoints: v1Stats.length,
      },
      v2: {
        requests: v2Total,
        endpoints: v2Stats.length,
      },
      migrationProgress: `${((v2Total / (v1Total + v2Total)) * 100).toFixed(2)}%`,
    },
    details: {
      v1: v1Stats,
      v2: v2Stats,
    },
  });
};
```

**Mount in app.ts:**
```typescript
import { versionAnalytics, getVersionStats } from './shared/middleware/version-analytics.middleware';

app.use('/api', versionAnalytics, routes);
app.get('/api/admin/version-stats', getVersionStats);
```

### Step 2: Create Migration Dashboard

Access `http://localhost:3000/api/admin/version-stats` to see:
- Total requests per version
- Endpoint usage breakdown
- Migration progress percentage

### Step 3: Sunset v1 (After 6+ months)

When v1 usage drops below 5%:

**src/routes/v1/index.ts**
```typescript
import { Router } from 'express';

const router = Router();

// Option 1: Hard shutdown
router.use((req, res) => {
  res.status(410).json({
    error: {
      code: 'VERSION_SUNSET',
      message: 'API v1 has been sunset on 2027-01-01. Please use v2.',
      sunsetDate: '2027-01-01',
      migrationGuide: 'https://docs.workdesk24.com/api/migration/v1-to-v2',
      v2Endpoint: req.path.replace('/v1/', '/v2/'),
    },
  });
});

export default router;
```

---

## Quick Reference: Commands

```bash
# Create all directories
npm run setup:v2

# Start dev server
npm run dev

# Test v1 endpoints
npm run test:v1

# Test v2 endpoints
npm run test:v2

# Build project
npm run build

# Check version stats
curl http://localhost:3000/api/admin/version-stats
```

Add to package.json:
```json
{
  "scripts": {
    "setup:v2": "bash scripts/setup-v2.sh",
    "test:v1": "bash tests/auth.v1.test.sh",
    "test:v2": "bash tests/auth.v2.test.sh"
  }
}
```

---

## Checklist: Implementing v2

- [ ] Phase 1: Document all v2 breaking changes
- [ ] Phase 2: Create directory structure
- [ ] Phase 3: Implement auth v2 (DTOs, mappers, controllers, routes)
- [ ] Phase 4: Test both v1 and v2
- [ ] Phase 5: Update Android app
- [ ] Phase 5: Update Next.js portal
- [ ] Phase 6: Deploy to staging
- [ ] Phase 6: Deploy to production
- [ ] Phase 6: Monitor usage
- [ ] Phase 6: Sunset v1 (after 6+ months)

---

**Your project is now ready for multi-version API support!** 🎉
