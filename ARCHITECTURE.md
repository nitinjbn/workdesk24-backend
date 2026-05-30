# Workdesk24 Architecture

## Overview
Node.js REST API with Express, Sequelize ORM, MySQL, JWT authentication, rate limiting, and email notifications. Designed for easy extraction into microservices later.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: MySQL
- **Authentication**: JWT (jsonwebtoken)
- **Email**: Nodemailer
- **File Upload**: Multer (S3-ready)
- **Rate Limiting**: express-rate-limit
- **Security**: bcryptjs, CORS

## Project Structure

```
workdesk24/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # Sequelize configuration
│   │   ├── email.js         # Nodemailer transporter
│   │   ├── rateLimit.js     # Rate limiting rules
│   │   ├── upload.js        # File upload (Multer/S3)
│   │   └── index.js         # Environment variables
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT verification
│   │   ├── errorHandler.js  # Global error handler
│   │   ├── rateLimiter.js   # Rate limit middleware
│   │   ├── validate.js      # Request validation
│   │   └── upload.js        # File upload middleware
│   │
│   ├── models/              # Sequelize models
│   │   ├── index.js         # Model auto-loader
│   │   ├── user.js          # User model
│   │   └── inquiry.js       # Inquiry model
│   │
│   ├── migrations/          # Database migrations
│   │   └── YYYYMMDDHHMMSS-*.js
│   │
│   ├── routes/              # API routes
│   │   ├── index.js         # Root router with versioning
│   │   ├── v1/              # Version 1 API
│   │   │   ├── index.js     # v1 main router
│   │   │   ├── admin/       # Admin routes
│   │   │   │   ├── index.js
│   │   │   │   ├── users.js
│   │   │   │   ├── inquiries.js
│   │   │   │   └── dashboard.js
│   │   │   ├── app/         # Authenticated app routes
│   │   │   │   ├── index.js
│   │   │   │   ├── profile.js
│   │   │   │   └── data.js
│   │   │   └── public/      # Public routes
│   │   │       ├── index.js
│   │   │       ├── inquiries.js
│   │   │       └── info.js
│   │   ├── authRoutes.js    # Legacy auth routes
│   │   └── userRoutes.js    # Legacy user routes
│   │
│   ├── controllers/         # Request handlers
│   │   ├── v1/
│   │   │   ├── admin/
│   │   │   │   ├── userController.js
│   │   │   │   ├── inquiryController.js
│   │   │   │   └── dashboardController.js
│   │   │   ├── app/
│   │   │   │   ├── profileController.js
│   │   │   │   └── dataController.js
│   │   │   └── public/
│   │   │       ├── inquiryController.js
│   │   │       └── infoController.js
│   │   ├── authController.js
│   │   └── userController.js
│   │
│   ├── services/            # Business logic
│   │   ├── authService.js   # JWT operations
│   │   └── emailService.js  # Email operations
│   │
│   ├── utils/               # Utility functions
│   │   ├── jwt.js           # JWT helpers
│   │   └── response.js      # Standardized API responses
│   │
│   ├── app.js               # Express app setup
│   └── server.js            # Server entry point
│
├── uploads/                 # Local file uploads (gitignored)
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment template
├── .sequelizerc             # Sequelize CLI config
├── package.json
├── CLAUDE.md                # AI assistant instructions
└── ARCHITECTURE.md          # This file
```

## API Versioning Strategy

### Current Implementation
- **Legacy routes**: `/api/*` (maintained for backward compatibility)
- **V1 routes**: `/api/v1/*` (new architecture)

### Route Hierarchy
```
/api/v1/
  ├── public/        # No authentication
  ├── app/           # User authentication required
  └── admin/         # Admin authentication required
```

## Authentication Flow

1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. Server generates JWT token with user payload
3. Client stores token (localStorage/sessionStorage)
4. Client includes token in requests: `Authorization: Bearer <token>`
5. `middleware/auth.js` verifies token and attaches `req.user`

## Rate Limiting Strategy

| Route Type | Window | Max Requests | Purpose |
|------------|--------|--------------|---------|
| Public | 15 min | 100 | General protection |
| Inquiry | 1 hour | 5 | Prevent spam submissions |
| Auth | 15 min | 10 | Brute force protection |
| Admin | 15 min | 500 | Higher admin capacity |
| App | 15 min | 300 | Moderate user capacity |

## Email Notification Flow

### Inquiry Submission
1. User submits inquiry via `/api/v1/public/inquiries`
2. Inquiry saved to database with metadata (IP, user-agent)
3. **Admin notification** sent to `ADMIN_EMAIL`
4. **Confirmation email** sent to user's email
5. Response returned to client

### Email Service Architecture
- **Transporter**: Configured in `config/email.js`
- **Templates**: Plain text + HTML templates in `services/emailService.js`
- **Error Handling**: Emails failures logged, don't block HTTP response

## File Upload Architecture

### Current Setup (Local Storage)
- **Storage**: `uploads/` directory (created automatically)
- **Middleware**: `middleware/upload.js` wraps Multer
- **Configuration**: `config/upload.js`
- **Validation**: File type + size limits (5MB)
- **Allowed types**: JPEG, PNG, PDF, DOC, DOCX

### S3 Migration Path (Future)
To migrate to S3, update `config/upload.js`:
```javascript
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });

const storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET,
  key: (req, file, cb) => {
    const uniqueKey = `uploads/${Date.now()}-${file.originalname}`;
    cb(null, uniqueKey);
  }
});
```

## Database Schema

### Users Table
```sql
users:
  - id (PK, AUTO_INCREMENT)
  - email (UNIQUE)
  - password (HASHED)
  - first_name
  - last_name
  - created_at
  - updated_at
```

### Inquiries Table
```sql
inquiries:
  - id (PK, AUTO_INCREMENT)
  - name
  - email (INDEXED)
  - phone
  - subject
  - message
  - status (ENUM: pending, in_progress, resolved, closed) (INDEXED)
  - priority (ENUM: low, medium, high, urgent)
  - ip_address
  - user_agent
  - assigned_to (FK -> users.id)
  - admin_notes
  - created_at (INDEXED)
  - updated_at
```

## Error Handling Strategy

### Standardized Responses
All responses follow this format:
```json
{
  "success": true|false,
  "message": "Human-readable message",
  "data": {...} // Only on success
  "errors": [...] // Only on validation errors
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

### Error Flow
1. Controller throws or returns error
2. `middleware/errorHandler.js` catches error
3. Standardized error response sent to client
4. Error logged to console (production: send to logging service)

## Microservice Extraction Strategy

### Current Monolith Benefits
- Simpler deployment
- Shared database transactions
- Lower operational complexity

### Future Microservice Candidates

#### 1. Inquiry Service
**Responsibility**: Handle inquiry submissions and management
- Routes: `/api/v1/public/inquiries`, `/api/v1/admin/inquiries`
- Database: `inquiries` table
- Dependencies: Email service

#### 2. User Service
**Responsibility**: User management and authentication
- Routes: `/api/v1/admin/users`, `/api/v1/app/profile`
- Database: `users` table
- Dependencies: None

#### 3. Notification Service
**Responsibility**: Email/SMS/Push notifications
- Current: `services/emailService.js`
- Future: Standalone service with queue (Redis/RabbitMQ)
- API: Internal gRPC or REST endpoints

### Extraction Checklist (Future)
- [ ] Define service boundaries (domain-driven design)
- [ ] Set up inter-service communication (REST/gRPC/MessageQueue)
- [ ] Implement API Gateway for routing
- [ ] Separate databases per service
- [ ] Set up distributed tracing (OpenTelemetry)
- [ ] Implement circuit breakers (resilience)
- [ ] Deploy with orchestration (Kubernetes/Docker Swarm)

## Security Considerations

### Implemented
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting on all routes
- ✅ CORS enabled
- ✅ Input validation ready (`middleware/validate.js`)
- ✅ SQL injection protection (Sequelize ORM)

### Recommended Additions
- [ ] Helmet.js for HTTP headers security
- [ ] Input sanitization (express-validator)
- [ ] HTTPS enforcement in production
- [ ] API key authentication for service-to-service
- [ ] Request signing for sensitive operations
- [ ] Audit logging for admin actions

## Deployment Considerations

### Environment Variables
Required in production:
- `NODE_ENV=production`
- `JWT_SECRET` (strong random string)
- `DB_*` (production database credentials)
- `SMTP_*` (email service credentials)

### Database Migrations
```bash
npm run db:migrate      # Run before deployment
```

### Process Management
- **Development**: `nodemon`
- **Production**: PM2 or containerized (Docker)

### Scaling Strategy
- **Horizontal**: Load balancer + multiple instances
- **Vertical**: Increase instance resources
- **Database**: Read replicas for queries, master for writes

## Testing Strategy (Future)

### Unit Tests
- Services: Business logic testing
- Utilities: Helper function testing

### Integration Tests
- Controllers: HTTP request/response testing
- Database: Model associations and queries

### E2E Tests
- Full user flows (register → login → inquiry submission)

## Monitoring & Observability (Future)

### Logging
- **Current**: Console logs
- **Production**: Winston + centralized logging (ELK/Datadog)

### Metrics
- Request latency
- Error rates
- Database query performance
- Rate limit hits

### Health Checks
- `/api/v1/public/info/health` - Application health
- Database connection check
- Email service connectivity

## Development Workflow

### Setup
1. `npm install`
2. Copy `.env.example` to `.env`
3. Create MySQL database: `workdesk24`
4. Run migrations: `npm run db:migrate`
5. Start dev server: `npm run dev`

### Adding New Features

#### New Model
1. Create model file in `src/models/`
2. Generate migration: `npx sequelize-cli migration:generate --name <name>`
3. Write migration in `src/migrations/`
4. Run migration: `npm run db:migrate`

#### New API Endpoint
1. Create route in `src/routes/v1/<category>/`
2. Create controller in `src/controllers/v1/<category>/`
3. Add service logic in `src/services/` if needed
4. Test endpoint manually or with Postman

## Performance Optimization

### Database
- Indexes on frequently queried columns (email, status, created_at)
- Pagination on list endpoints
- Eager loading for associations (avoid N+1 queries)

### Caching (Future)
- Redis for session storage
- Cache frequently accessed data (dashboard stats)
- Cache invalidation on updates

### CDN (Future)
- Serve static assets via CDN
- S3 + CloudFront for file uploads
