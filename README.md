# Workdesk24 - Enterprise REST API

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A production-ready Node.js REST API with Express, Sequelize ORM, MySQL, JWT authentication, rate limiting, and email notifications. Designed with a modular architecture for easy extraction into microservices.

---

## 🚀 Features

### Core Features
- ✅ **Versioned API Architecture** (`/api/v1/*`)
- ✅ **JWT Authentication** with bcrypt password hashing
- ✅ **Rate Limiting** on all route groups
- ✅ **Email Notifications** via Nodemailer
- ✅ **File Upload** support (Multer, S3-ready)
- ✅ **Inquiry Management System** with status tracking
- ✅ **Admin Dashboard** with statistics
- ✅ **User Profile Management**
- ✅ **Standardized API Responses**
- ✅ **Database Migrations** with Sequelize

### Security
- Password hashing with bcrypt
- JWT token-based authentication
- Rate limiting per route category
- CORS enabled
- SQL injection protection (Sequelize ORM)
- Input validation framework ready

### Developer Experience
- Hot reload with Nodemon
- Comprehensive documentation
- Postman collection included
- Clear error messages
- Modular folder structure
- Easy to test and extend

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8+
- npm or yarn

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database and SMTP credentials
```

3. **Create database**
```sql
CREATE DATABASE workdesk24;
```

4. **Run migrations**
```bash
npm run db:migrate
```

5. **Start development server**
```bash
npm run dev
```

Server runs on: `http://localhost:3000`

---

## 📁 Project Structure

```
workdesk24/
├── src/
│   ├── config/              # Configuration files
│   ├── middleware/          # Express middleware
│   ├── models/              # Sequelize models
│   ├── routes/v1/           # API routes (versioned)
│   │   ├── public/          # Public routes (no auth)
│   │   ├── app/             # App routes (user auth)
│   │   └── admin/           # Admin routes (admin auth)
│   ├── controllers/v1/      # Request handlers
│   ├── services/            # Business logic
│   └── utils/               # Utility functions
├── uploads/                 # File uploads (gitignored)
├── ARCHITECTURE.md          # Architecture documentation
├── API_TESTING.md           # API testing guide
├── PROJECT_SUMMARY.md       # Project overview
└── README.md                # This file
```

---

## 🔌 API Endpoints

### Public Routes (No Authentication)
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/api/v1/public/info/health` | Health check | 100/15min |
| GET | `/api/v1/public/info/version` | API version | 100/15min |
| POST | `/api/v1/public/inquiries` | Submit inquiry | 5/hour |

### App Routes (User Authentication Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/app/profile` | Get user profile |
| PUT | `/api/v1/app/profile` | Update profile |
| PUT | `/api/v1/app/profile/password` | Change password |

### Admin Routes (Admin Authentication Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/inquiries` | List all inquiries (paginated) |
| GET | `/api/v1/admin/inquiries/:id` | Get inquiry details |
| PUT | `/api/v1/admin/inquiries/:id` | Update inquiry |
| DELETE | `/api/v1/admin/inquiries/:id` | Delete inquiry |
| POST | `/api/v1/admin/inquiries/:id/assign` | Assign to admin |
| PUT | `/api/v1/admin/inquiries/:id/status` | Update status |
| GET | `/api/v1/admin/users` | List users (paginated) |
| GET | `/api/v1/admin/dashboard/stats` | Dashboard statistics |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Complete system architecture and design patterns |
| **[API_TESTING.md](API_TESTING.md)** | Comprehensive API testing guide with examples |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | Project overview and quick reference |
| **[CLAUDE.md](CLAUDE.md)** | AI assistant instructions and guidelines |
| **[Postman Collection](Workdesk24_API.postman_collection.json)** | Import into Postman for quick testing |

---

## 🧪 Quick Test

```bash
# Health Check
curl http://localhost:3000/api/v1/public/info/health

# Submit Inquiry
curl -X POST http://localhost:3000/api/v1/public/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Inquiry",
    "message": "This is a test message"
  }'
```

**Detailed testing guide:** [API_TESTING.md](API_TESTING.md)

---

## 📊 Project Statistics

- **44 source files** created
- **11 route files** (v1 API structure)
- **7 controllers** (public, app, admin)
- **2 services** (auth, email)
- **5 middleware** (auth, rate limiter, upload, validation, error handler)
- **3 models** (User, Inquiry with relationships)
- **5 config files** (database, email, rate limit, upload)

---

## 🔄 Database Commands

```bash
npm run db:migrate        # Run all pending migrations
npm run db:migrate:undo   # Rollback last migration
npm run db:seed           # Run database seeders
npm run db:seed:undo      # Undo database seeders
```

---

## 🎯 Key Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **ORM**: Sequelize 6.x
- **Database**: MySQL 8.x
- **Authentication**: JWT (jsonwebtoken)
- **Email**: Nodemailer
- **File Upload**: Multer
- **Rate Limiting**: express-rate-limit
- **Security**: bcryptjs, CORS

---

**Built with ❤️ for scalability and maintainability**
