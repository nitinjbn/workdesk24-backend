# Inquiry API Fix Summary

## Issue Found
The `wd_inquiries` table has `subject` as a **REQUIRED** field, but the API was not accepting it.

## Fields Required:
- ✅ `name` (string, required)
- ✅ `email` (string, required)
- ✅ `subject` (string, required) ⚠️ **THIS WAS MISSING**
- ✅ `message` (text, required)
- ⚠️ `phone` (string, optional)

## Files Fixed:

### 1. `src/modules/public/controllers/inquiry.controller.ts`
**Changed:**
```typescript
// OLD
const { name, email, phone, message } = req.body;
if (!name || !email || !message) {

// NEW
const { name, email, phone, subject, message } = req.body;
if (!name || !email || !subject || !message) {
```

### 2. `src/modules/public/services/inquiry.service.ts`
**Changed:**
```typescript
// OLD
interface CreateInquiryDto {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

// NEW
interface CreateInquiryDto {
  name: string;
  email: string;
  phone?: string;
  subject: string;  // ADDED
  message: string;
}
```

### 3. `src/modules/public/types/index.ts`
**Changed:**
```typescript
// Added subject field to CreateInquiryDto interface
subject: string;
```

## Correct API Request Format:

### POST `/api/v1/public/inquiry/create`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Product Inquiry",
  "message": "I want to know more about your products",
  "phone": "1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Inquiry submitted successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Product Inquiry",
    "message": "I want to know more about your products",
    "phone": "1234567890",
    "status": "pending",
    "priority": "medium",
    "createdAt": 1780151263,
    "updatedAt": 1780151263,
    "isDeleted": 0,
    "deletedAt": null
  }
}
```

**Response (Error - Missing Fields):**
```json
{
  "success": false,
  "message": "Name, email, subject, and message are required"
}
```

## Testing:

### Using curl:
```bash
curl -X POST http://localhost:3000/api/v1/public/inquiry/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@test.com",
    "phone": "1234567890",
    "subject": "Test Subject",
    "message": "This is a test inquiry message"
  }'
```

### Using Postman:
1. Method: POST
2. URL: `http://localhost:3000/api/v1/public/inquiry/create`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "name": "Test User",
  "email": "test@test.com",
  "phone": "1234567890",
  "subject": "Test Subject",
  "message": "This is a test inquiry"
}
```

## Database Schema (wd_inquiries):

Required fields:
- `name` VARCHAR(100)
- `email` VARCHAR(255)
- **`subject` VARCHAR(200)** ← Was missing from API
- `message` TEXT
- `status` ENUM (default: 'pending')
- `priority` ENUM (default: 'medium')
- `createdAt` BIGINT
- `updatedAt` BIGINT
- `isDeleted` TINYINT (default: 0)

Optional fields:
- `phone` VARCHAR(20)
- `source` VARCHAR(50)
- `ipAddress` VARCHAR(45)
- `userAgent` VARCHAR(500)
- `assignedTo` INT
- `adminNotes` TEXT
- `resolvedAt` BIGINT
- `deletedAt` BIGINT

## Status
✅ **FIXED** - Subject field now required in API

## Next Steps:
1. ✅ Rebuild TypeScript: `npm run build`
2. ✅ Restart server: `npm start` or `npm run dev`
3. ✅ Test API with subject field
4. ✅ Update Postman collection
5. ✅ Update mobile app to include subject field
6. ✅ Update documentation
