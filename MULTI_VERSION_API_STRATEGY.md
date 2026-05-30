# Multi-Version API Strategy: Comprehensive Plan

## Table of Contents
1. [Overview](#overview)
2. [Version Strategy](#version-strategy)
3. [Architecture Pattern](#architecture-pattern)
4. [Practical Implementation](#practical-implementation)
5. [Real-World Examples](#real-world-examples)
6. [Migration Steps](#migration-steps)
7. [Testing Strategy](#testing-strategy)
8. [Monitoring & Sunset](#monitoring--sunset)

---

## Overview

### Goal
Run multiple API versions simultaneously where:
- ✅ **v1** uses old payload/response formats
- ✅ **v2** uses new payload/response formats
- ✅ Both versions share business logic
- ✅ Easy to maintain and extend
- ✅ Clear migration path for clients

### Key Principles

1. **Separation of Concerns**
   - DTOs (Data Transfer Objects) per version
   - Routes per version
   - Controllers can be shared or separate
   - Business logic shared via services

2. **Backward Compatibility**
   - v1 never changes (frozen after v2 release)
   - Old clients continue working indefinitely
   - No surprise breaking changes

3. **Gradual Migration**
   - Run both versions simultaneously
   - Clients migrate at their own pace
   - Monitor usage to decide sunset

---

## Version Strategy

### When to Create a New Version

**Major Version (v1 → v2) - Breaking Changes:**
- ❌ Removing endpoints
- ❌ Removing required/response fields
- ❌ Changing field data types (string → number)
- ❌ Changing authentication method
- ❌ Restructuring response format
- ❌ Renaming fields

**Minor Updates (Same Version) - Non-Breaking:**
- ✅ Adding new endpoints
- ✅ Adding optional fields
- ✅ Adding new response fields
- ✅ Bug fixes
- ✅ Performance improvements

### Example: When v2 is Needed

**Scenario:** You want to change user registration response format

**v1 Format (Current):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": 1672531200
  }
}
```

**v2 Format (New - BREAKING CHANGE):**
```json
{
  "user": {
    "id": 123,
    "email": "user@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "metadata": {
      "createdAt": "2023-01-01T00:00:00Z",
      "emailVerified": false
    }
  },
  "token": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600
  }
}
```

**Breaking Changes:**
- Structure completely different
- `name` split into `firstName` and `lastName`
- `createdAt` format changed from UNIX to ISO8601
- Added new fields (`emailVerified`, tokens)
- Removed `success` and `message` wrapper

→ **This requires v2!**

---

## Architecture Pattern

### Layered Architecture for Multi-Version APIs

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                          │
│                      /api/v1  /api/v2                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌──────────────────┴──────────────────┐
        │                                      │
┌───────▼────────┐                   ┌────────▼───────┐
│  v1 Routes     │                   │  v2 Routes     │
│  v1 DTOs       │                   │  v2 DTOs       │
│  v1 Mappers    │                   │  v2 Mappers    │
└───────┬────────┘                   └────────┬───────┘
        │                                      │
        └──────────────────┬──────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Controllers       │
                │  (Version Aware)    │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │   Services Layer    │
                │  (Version Agnostic) │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │   Repository Layer  │
                │  (Database Access)  │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │   Database Models   │
                └─────────────────────┘
```

### Key Layers

1. **Routes Layer** - Version-specific route definitions
2. **DTOs Layer** - Version-specific request/response interfaces
3. **Mappers Layer** - Transform between versions and domain models
4. **Controllers Layer** - Can be shared or version-specific
5. **Services Layer** - **Shared business logic** (version agnostic)
6. **Repository Layer** - **Shared data access** (version agnostic)
7. **Models Layer** - **Shared database models** (version agnostic)

---

## Practical Implementation

### Project Structure

```
src/
├── modules/
│   └── auth/
│       ├── dto/
│       │   ├── v1/
│       │   │   ├── register.dto.ts
│       │   │   ├── login.dto.ts
│       │   │   └── user-response.dto.ts
│       │   └── v2/
│       │       ├── register.dto.ts
│       │       ├── login.dto.ts
│       │       └── user-response.dto.ts
│       ├── mappers/
│       │   ├── v1.mapper.ts
│       │   └── v2.mapper.ts
│       ├── controllers/
│       │   ├── v1.auth.controller.ts
│       │   └── v2.auth.controller.ts
│       ├── services/
│       │   └── auth.service.ts          ← Shared
│       ├── repositories/
│       │   └── user.repository.ts       ← Shared
│       └── routes/
│           ├── v1.routes.ts
│           └── v2.routes.ts
│
├── routes/
│   ├── index.ts
│   ├── v1/
│   │   └── index.ts
│   └── v2/
│       └── index.ts
│
└── models/
    └── schemas/
        └── User.ts                       ← Shared
```

### 1. DTOs (Data Transfer Objects)

**src/modules/auth/dto/v1/register.dto.ts**
```typescript
// V1 - Old format
export interface RegisterRequestV1 {
  email: string;
  password: string;
  name: string;  // Single field
}

export interface UserResponseV1 {
  success: boolean;
  message: string;
  data: {
    id: number;
    email: string;
    name: string;
    createdAt: number;  // UNIX timestamp
  };
}
```

**src/modules/auth/dto/v2/register.dto.ts**
```typescript
// V2 - New format
export interface RegisterRequestV2 {
  email: string;
  password: string;
  firstName: string;  // Split name
  lastName: string;
}

export interface UserResponseV2 {
  user: {
    id: number;
    email: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    metadata: {
      createdAt: string;  // ISO8601 format
      emailVerified: boolean;
    };
  };
  token: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}
```

### 2. Mappers (Transform Between Versions)

**src/modules/auth/mappers/v1.mapper.ts**
```typescript
import { User } from '../../../models/schemas/User';
import { UserResponseV1, RegisterRequestV1 } from '../dto/v1/register.dto';

export class AuthMapperV1 {
  // Map database model to v1 response
  static toUserResponse(user: User, token?: string): UserResponseV1 {
    return {
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        createdAt: user.createdAt,  // Already UNIX timestamp
      },
    };
  }

  // Map v1 request to domain model
  static toCreateUserData(dto: RegisterRequestV1) {
    return {
      email: dto.email,
      password: dto.password,
      name: dto.name,  // Single field
      role: 'user' as const,
    };
  }
}
```

**src/modules/auth/mappers/v2.mapper.ts**
```typescript
import { User } from '../../../models/schemas/User';
import { UserResponseV2, RegisterRequestV2 } from '../dto/v2/register.dto';

export class AuthMapperV2 {
  // Map database model to v2 response
  static toUserResponse(
    user: User,
    accessToken: string,
    refreshToken: string
  ): UserResponseV2 {
    // Split name into firstName and lastName
    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      user: {
        id: user.id,
        email: user.email,
        profile: {
          firstName,
          lastName,
        },
        metadata: {
          createdAt: new Date(user.createdAt * 1000).toISOString(),  // UNIX → ISO8601
          emailVerified: false,  // New field in v2
        },
      },
      token: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
      },
    };
  }

  // Map v2 request to domain model
  static toCreateUserData(dto: RegisterRequestV2) {
    return {
      email: dto.email,
      password: dto.password,
      name: `${dto.firstName} ${dto.lastName}`.trim(),  // Combine names
      role: 'user' as const,
    };
  }
}
```

### 3. Shared Service (Version Agnostic)

**src/modules/auth/services/auth.service.ts**
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository';

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'staff' | 'user';
}

interface LoginResult {
  user: any;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  // Shared business logic - no version awareness
  async register(userData: CreateUserData) {
    // Check if user exists
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user
    const user = await userRepository.create({
      ...userData,
      password: hashedPassword,
    });

    return user;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    // Find user
    const user = await userRepository.findWithPassword(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Update last login
    await userRepository.update(user.id, {
      lastLoginAt: Math.floor(Date.now() / 1000),
    });

    return { user, accessToken, refreshToken };
  }

  private generateAccessToken(userId: number): string {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
  }

  private generateRefreshToken(userId: number): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
  }
}

export default new AuthService();
```

### 4. Version-Specific Controllers

**src/modules/auth/controllers/v1.auth.controller.ts**
```typescript
import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { AuthMapperV1 } from '../mappers/v1.mapper';
import { RegisterRequestV1 } from '../dto/v1/register.dto';

export class AuthControllerV1 {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const dto: RegisterRequestV1 = req.body;

      // Validate v1 format
      if (!dto.email || !dto.password || !dto.name) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
        return;
      }

      // Transform v1 DTO to domain data
      const userData = AuthMapperV1.toCreateUserData(dto);

      // Call shared service
      const user = await authService.register(userData);

      // Transform to v1 response
      const response = AuthMapperV1.toUserResponse(user);

      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Call shared service
      const { user, accessToken } = await authService.login(email, password);

      // Transform to v1 response (includes token in cookie or header)
      const response = AuthMapperV1.toUserResponse(user);

      // V1 returns token in header
      res.setHeader('Authorization', `Bearer ${accessToken}`);
      res.json(response);
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AuthControllerV1();
```

**src/modules/auth/controllers/v2.auth.controller.ts**
```typescript
import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { AuthMapperV2 } from '../mappers/v2.mapper';
import { RegisterRequestV2 } from '../dto/v2/register.dto';

export class AuthControllerV2 {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const dto: RegisterRequestV2 = req.body;

      // Validate v2 format
      if (!dto.email || !dto.password || !dto.firstName || !dto.lastName) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            fields: ['email', 'password', 'firstName', 'lastName'],
          },
        });
        return;
      }

      // Transform v2 DTO to domain data
      const userData = AuthMapperV2.toCreateUserData(dto);

      // Call shared service
      const user = await authService.register(userData);

      // Generate tokens for v2 (included in response body)
      const { accessToken, refreshToken } = await authService.login(
        user.email,
        dto.password
      );

      // Transform to v2 response
      const response = AuthMapperV2.toUserResponse(
        user,
        accessToken,
        refreshToken
      );

      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message,
        },
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Call shared service
      const { user, accessToken, refreshToken } = await authService.login(
        email,
        password
      );

      // Transform to v2 response (tokens in body)
      const response = AuthMapperV2.toUserResponse(
        user,
        accessToken,
        refreshToken
      );

      res.json(response);
    } catch (error: any) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message,
        },
      });
    }
  }
}

export default new AuthControllerV2();
```

### 5. Version-Specific Routes

**src/modules/auth/routes/v1.routes.ts**
```typescript
import { Router } from 'express';
import authControllerV1 from '../controllers/v1.auth.controller';

const router = Router();

router.post('/register', authControllerV1.register.bind(authControllerV1));
router.post('/login', authControllerV1.login.bind(authControllerV1));

export default router;
```

**src/modules/auth/routes/v2.routes.ts**
```typescript
import { Router } from 'express';
import authControllerV2 from '../controllers/v2.auth.controller';

const router = Router();

router.post('/register', authControllerV2.register.bind(authControllerV2));
router.post('/login', authControllerV2.login.bind(authControllerV2));

export default router;
```

### 6. Version Aggregators

**src/routes/v1/index.ts** (Already exists)
```typescript
import { Router } from 'express';
import authRoutesV1 from '../../modules/auth/routes/v1.routes';
import appRoutes from './app';
import adminRoutes from './admin';
import publicRoutes from './public';

const router = Router();

router.use('/auth', authRoutesV1);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

**src/routes/v2/index.ts** (NEW)
```typescript
import { Router } from 'express';
import authRoutesV2 from '../../modules/auth/routes/v2.routes';
import appRoutes from './app';
import adminRoutes from './admin';
import publicRoutes from './public';

const router = Router();

// V2 auth with new format
router.use('/auth', authRoutesV2);

// Other modules (can be same as v1 or different)
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
```

**src/routes/index.ts** (Update)
```typescript
import { Router } from 'express';
import v1Routes from './v1';
import v2Routes from './v2';

const router = Router();

// Both versions running simultaneously
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    data: {
      timestamp: Math.floor(Date.now() / 1000),
      version: '2.0.0',
      supportedVersions: ['v1', 'v2'],
    },
  });
});

export default router;
```

---

## Real-World Examples

### Example 1: Authentication

**Client Request v1:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

**v1 Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": 1672531200
  }
}
```

**Client Request v2:**
```bash
curl -X POST http://localhost:3000/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**v2 Response:**
```json
{
  "user": {
    "id": 123,
    "email": "user@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "metadata": {
      "createdAt": "2023-01-01T00:00:00Z",
      "emailVerified": false
    }
  },
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

### Example 2: Data Sync (Attendance)

**v1 Format:**
```json
// POST /api/v1/app/sync
{
  "attendance": [
    {
      "localId": "att_123",
      "checkInTime": 1672531200,
      "checkOutTime": 1672563600,
      "lat": 28.6139,
      "lng": 77.2090
    }
  ]
}
```

**v2 Format (Improved):**
```json
// POST /api/v2/app/sync
{
  "batchId": "batch_uuid_123",
  "deviceInfo": {
    "deviceId": "device_123",
    "appVersion": "2.0.0"
  },
  "attendance": [
    {
      "localId": "att_123",
      "timestamps": {
        "checkIn": "2023-01-01T09:00:00Z",
        "checkOut": "2023-01-01T18:00:00Z"
      },
      "location": {
        "checkIn": {
          "latitude": 28.6139,
          "longitude": 77.2090,
          "accuracy": 5.2
        },
        "checkOut": {
          "latitude": 28.6140,
          "longitude": 77.2091,
          "accuracy": 4.8
        }
      }
    }
  ]
}
```

---

## Migration Steps

### Step 1: Analyze Breaking Changes

Document all differences between v1 and v2:

**Breaking Changes Checklist:**
- [ ] Field name changes
- [ ] Field type changes
- [ ] Data format changes (UNIX → ISO8601)
- [ ] Structure changes (flat → nested)
- [ ] New required fields
- [ ] Removed fields
- [ ] Authentication method changes

### Step 2: Create v2 Structure

```bash
# Create v2 directories
mkdir -p src/routes/v2/auth
mkdir -p src/routes/v2/app
mkdir -p src/routes/v2/admin
mkdir -p src/routes/v2/public

# Create DTO directories
mkdir -p src/modules/auth/dto/v2
mkdir -p src/modules/staff/dto/v2

# Create mapper directories
mkdir -p src/modules/auth/mappers
mkdir -p src/modules/staff/mappers

# Create v2 controller directories
mkdir -p src/modules/auth/controllers
mkdir -p src/modules/staff/controllers
```

### Step 3: Implement v2 DTOs

For each module, create v2 DTOs:
- Request DTOs
- Response DTOs
- Validation schemas

### Step 4: Implement Mappers

Create mappers to transform:
- v2 DTO → Domain model
- Domain model → v2 Response
- Optional: v1 ↔ v2 conversion

### Step 5: Implement v2 Controllers

Options:
- **Option A:** Create separate v2 controllers
- **Option B:** Add version parameter to existing controllers
- **Recommendation:** Separate controllers for clarity

### Step 6: Implement v2 Routes

Mount v2 routes under `/v2` prefix.

### Step 7: Add Deprecation Headers to v1

```typescript
// src/routes/v1/index.ts
router.use((req, res, next) => {
  // Add deprecation warnings
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('Deprecation', 'Sun, 01 Jul 2026 00:00:00 GMT');
  res.setHeader('Sunset', 'Mon, 01 Jan 2027 00:00:00 GMT');
  res.setHeader('Link', '</api/v2>; rel="successor-version"');
  next();
});
```

### Step 8: Update Documentation

- Create v2 API documentation
- Keep v1 documentation (mark as deprecated)
- Document migration guide
- Provide code examples for both versions

### Step 9: Test Both Versions

- Unit tests for v1 and v2
- Integration tests for v1 and v2
- Ensure v1 still works exactly as before
- Ensure v2 works with new format

### Step 10: Deploy Both Versions

- Deploy to staging
- Test with real clients
- Monitor error rates
- Deploy to production

---

## Testing Strategy

### Unit Tests

**tests/modules/auth/mappers/v1.mapper.spec.ts**
```typescript
import { AuthMapperV1 } from '../../../../src/modules/auth/mappers/v1.mapper';

describe('AuthMapperV1', () => {
  describe('toUserResponse', () => {
    it('should map user to v1 response format', () => {
      const user = {
        id: 123,
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: 1672531200,
      } as any;

      const response = AuthMapperV1.toUserResponse(user);

      expect(response).toEqual({
        success: true,
        message: 'User registered successfully',
        data: {
          id: 123,
          email: 'user@example.com',
          name: 'John Doe',
          createdAt: 1672531200,
        },
      });
    });
  });
});
```

**tests/modules/auth/mappers/v2.mapper.spec.ts**
```typescript
import { AuthMapperV2 } from '../../../../src/modules/auth/mappers/v2.mapper';

describe('AuthMapperV2', () => {
  describe('toUserResponse', () => {
    it('should map user to v2 response format', () => {
      const user = {
        id: 123,
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: 1672531200,
      } as any;

      const response = AuthMapperV2.toUserResponse(
        user,
        'access_token',
        'refresh_token'
      );

      expect(response.user.id).toBe(123);
      expect(response.user.profile.firstName).toBe('John');
      expect(response.user.profile.lastName).toBe('Doe');
      expect(response.user.metadata.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(response.token.accessToken).toBe('access_token');
    });

    it('should split name correctly', () => {
      const user = {
        id: 123,
        email: 'user@example.com',
        name: 'John William Doe',
        createdAt: 1672531200,
      } as any;

      const response = AuthMapperV2.toUserResponse(
        user,
        'access_token',
        'refresh_token'
      );

      expect(response.user.profile.firstName).toBe('John');
      expect(response.user.profile.lastName).toBe('William Doe');
    });
  });
});
```

### Integration Tests

**tests/integration/auth.v1.spec.ts**
```typescript
import request from 'supertest';
import app from '../../src/app';

describe('Auth API v1', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register user with v1 format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'John Doe',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        data: {
          id: expect.any(Number),
          email: 'test@example.com',
          name: 'John Doe',
          createdAt: expect.any(Number),
        },
      });
    });
  });
});
```

**tests/integration/auth.v2.spec.ts**
```typescript
import request from 'supertest';
import app from '../../src/app';

describe('Auth API v2', () => {
  describe('POST /api/v2/auth/register', () => {
    it('should register user with v2 format', async () => {
      const response = await request(app)
        .post('/api/v2/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        user: {
          id: expect.any(Number),
          email: 'test@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
          metadata: {
            createdAt: expect.any(String),
            emailVerified: false,
          },
        },
        token: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: 3600,
        },
      });

      // Verify ISO8601 format
      expect(response.body.user.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
```

---

## Monitoring & Sunset

### 1. Add Version Tracking Middleware

**src/shared/middleware/version-tracker.middleware.ts**
```typescript
import { Request, Response, NextFunction } from 'express';

export const versionTracker = (req: Request, res: Response, next: NextFunction) => {
  const version = req.path.startsWith('/v2') ? 'v2' : 'v1';
  
  // Log to analytics (e.g., Google Analytics, Mixpanel, etc.)
  console.log(`API Version: ${version}, Endpoint: ${req.path}, User: ${req.user?.id || 'anonymous'}`);
  
  // Can also track in database or external service
  // await analyticsService.track({
  //   event: 'api_call',
  //   version,
  //   endpoint: req.path,
  //   userId: req.user?.id,
  //   timestamp: Date.now(),
  // });

  next();
};
```

**Mount in app.ts:**
```typescript
import { versionTracker } from './shared/middleware/version-tracker.middleware';

app.use('/api', versionTracker, routes);
```

### 2. Create Version Usage Dashboard

Track:
- Requests per version (v1 vs v2)
- Unique users per version
- Endpoints usage per version
- Error rates per version

### 3. Deprecation Timeline

**Example Timeline:**

| Date | Action |
|------|--------|
| Day 0 | Launch v2 alongside v1 |
| Day 30 | Send email to all API consumers about v2 |
| Day 60 | Add deprecation headers to v1 |
| Day 90 | Analyze v1 usage, reach out to heavy users |
| Day 120 | Announce v1 sunset date (6 months out) |
| Day 270 | Final warning: v1 sunsets in 30 days |
| Day 300 | Sunset v1 (returns 410 Gone) |

### 4. Sunset Implementation

**Option A: Hard Shutdown**
```typescript
// src/routes/v1/index.ts
router.use((req, res) => {
  res.status(410).json({
    error: {
      code: 'VERSION_SUNSET',
      message: 'API v1 has been sunset. Please upgrade to v2.',
      sunsetDate: '2027-01-01',
      migrationGuide: 'https://docs.example.com/api/v1-to-v2',
    },
  });
});
```

**Option B: Soft Deprecation (Redirect)**
```typescript
// src/routes/v1/index.ts
router.use((req, res, next) => {
  const v2Path = req.path.replace('/v1/', '/v2/');
  
  res.status(301)
    .setHeader('Location', v2Path)
    .json({
      error: {
        code: 'VERSION_DEPRECATED',
        message: 'Redirecting to v2',
        newUrl: v2Path,
      },
    });
});
```

---

## Summary: Key Takeaways

### ✅ Architecture Layers

1. **Routes** - Version-specific
2. **DTOs** - Version-specific
3. **Mappers** - Version-specific (transform data)
4. **Controllers** - Can be shared or version-specific
5. **Services** - **Shared** (business logic)
6. **Repositories** - **Shared** (data access)
7. **Models** - **Shared** (database schema)

### ✅ Benefits

- ✅ Clean separation between versions
- ✅ No code duplication in business logic
- ✅ Easy to add v3, v4, etc.
- ✅ Backward compatibility guaranteed
- ✅ Clear migration path

### ✅ Best Practices

1. **Never change v1 after v2 release** - Freeze it
2. **Share business logic** - DRY principle
3. **Version entire API** - Not individual endpoints
4. **Use mappers** - Clean transformation layer
5. **Test both versions** - Prevent regressions
6. **Monitor usage** - Data-driven sunset decisions
7. **Document everything** - Help developers migrate

---

**You're now ready to implement multi-version APIs!** 🚀
