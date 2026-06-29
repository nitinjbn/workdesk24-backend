# Sync API Implementation Guide

## Overview
This document describes the data synchronization APIs implemented for the Workdesk24 Android application. These APIs allow the mobile app to sync local data (attendance, GPS history, visits, orders, payments, feedback, and images) with the server.

## Database Schema

All tables use the `wd_` prefix as required:

### Core Tables
- `wd_users` - User accounts
- `wd_inquiries` - Customer inquiries
- `wd_attendance` - Employee attendance records
- `wd_gps_history` - GPS location tracking history
- `wd_visits` - Customer visit records
- `wd_orders` - Order/sales records
- `wd_payments` - Payment transactions
- `wd_feedback` - Customer feedback records
- `wd_images` - Image attachments (can be linked to any entity)

### Key Features
- All sync tables include `local_id` field for Android app local database ID mapping
- `synced_at` timestamp tracks last sync time
- `user_id` foreign key links records to users
- Support for GPS coordinates (latitude/longitude)
- Proper indexes for performance

## API Endpoints

All sync endpoints require JWT authentication via Bearer token and use POST method.

### Base URL
```
/api/v1/app/sync
```

### Individual Sync Endpoints

#### 1. Sync Attendance
**POST** `/api/v1/app/sync/attendance`

Request body:
```json
{
  "records": [
    {
      "localId": "att_001",
      "checkInTime": "2026-05-30T09:00:00Z",
      "checkOutTime": "2026-05-30T17:30:00Z",
      "checkInLat": 28.6139,
      "checkInLng": 77.2090,
      "checkOutLat": 28.6140,
      "checkOutLng": 77.2091,
      "workingHours": 8.5,
      "status": "checked_out",
      "notes": "Regular day"
    }
  ]
}
```

#### 2. Sync GPS History
**POST** `/api/v1/app/sync/gps-history`

Request body:
```json
{
  "records": [
    {
      "localId": "gps_001",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "accuracy": 5.2,
      "altitude": 220.5,
      "speed": 0,
      "bearing": 0,
      "recordedAt": "2026-05-30T09:00:00Z",
      "batteryLevel": 85,
      "activityType": "still"
    }
  ]
}
```

#### 3. Sync Visits
**POST** `/api/v1/app/sync/visits`

Request body:
```json
{
  "records": [
    {
      "localId": "visit_001",
      "customerName": "ABC Corporation",
      "customerPhone": "+919876543210",
      "customerEmail": "contact@abc.com",
      "address": "123 Business Park, Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "visitType": "meeting",
      "purpose": "Product demonstration",
      "notes": "Interested in premium package",
      "checkInTime": "2026-05-30T10:00:00Z",
      "checkOutTime": "2026-05-30T11:30:00Z",
      "duration": 90,
      "status": "completed",
      "outcome": "success"
    }
  ]
}
```

#### 4. Sync Orders
**POST** `/api/v1/app/sync/orders`

Request body:
```json
{
  "records": [
    {
      "localId": "order_001",
      "orderNumber": "ORD-2026-001",
      "customerName": "ABC Corporation",
      "customerPhone": "+919876543210",
      "customerEmail": "contact@abc.com",
      "deliveryAddress": "123 Business Park, Delhi",
      "items": [
        {
          "productId": "P001",
          "productName": "Product A",
          "quantity": 10,
          "unitPrice": 500,
          "total": 5000
        }
      ],
      "totalAmount": 10000,
      "taxAmount": 1800,
      "discountAmount": 500,
      "netAmount": 11300,
      "status": "confirmed",
      "paymentStatus": "pending",
      "orderDate": "2026-05-30T11:30:00Z",
      "deliveryDate": "2026-06-05T00:00:00Z",
      "notes": "Deliver to warehouse"
    }
  ]
}
```

#### 5. Sync Payments
**POST** `/api/v1/app/sync/payments`

Request body:
```json
{
  "records": [
    {
      "localId": "payment_001",
      "orderId": null,
      "transactionId": "TXN123456789",
      "amount": 5000,
      "paymentMethod": "upi",
      "paymentDate": "2026-05-30T12:00:00Z",
      "status": "completed",
      "referenceNumber": "UPI/REF/123456",
      "notes": "Advance payment",
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  ]
}
```

#### 6. Sync Feedback
**POST** `/api/v1/app/sync/feedback`

Request body:
```json
{
  "records": [
    {
      "localId": "feedback_001",
      "relatedType": "visit",
      "relatedId": null,
      "customerName": "ABC Corporation",
      "customerPhone": "+919876543210",
      "rating": 5,
      "category": "Product Quality",
      "subject": "Excellent service",
      "message": "Very satisfied with the product demonstration.",
      "sentiment": "positive",
      "status": "pending",
      "feedbackDate": "2026-05-30T11:30:00Z",
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  ]
}
```

#### 7. Sync Images
**POST** `/api/v1/app/sync/images`

Request body:
```json
{
  "records": [
    {
      "localId": "img_001",
      "relatedType": "visit",
      "relatedId": null,
      "fileName": "visit_photo_001.jpg",
      "originalName": "IMG_20260530_103045.jpg",
      "filePath": "/uploads/visits/2026/05/visit_photo_001.jpg",
      "fileSize": 245680,
      "mimeType": "image/jpeg",
      "base64Data": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
      "width": 1920,
      "height": 1080,
      "latitude": 28.6139,
      "longitude": 77.2090,
      "capturedAt": "2026-05-30T10:30:00Z",
      "description": "Meeting room photo"
    }
  ]
}
```

### Bulk Sync Endpoint

#### 8. Sync All Data
**POST** `/api/v1/app/sync/all`

Sync multiple data types in a single request:

Request body:
```json
{
  "attendance": [...],
  "gpsHistory": [...],
  "visits": [...],
  "orders": [...],
  "payments": [...],
  "feedback": [...],
  "images": [...]
}
```

### Server Update Endpoints

#### 9. Get Server Updates
**POST** `/api/v1/app/sync/get-updates`

Retrieve records modified on server since last sync:

Request body:
```json
{
  "lastSyncTime": "2026-05-30T08:00:00Z"
}
```

Response:
```json
{
  "success": true,
  "message": "Updates retrieved successfully",
  "data": {
    "attendance": [...],
    "gpsHistory": [...],
    "visits": [...],
    "orders": [...],
    "payments": [...],
    "feedback": [...],
    "images": [...],
    "syncTime": "2026-05-30T12:00:00Z"
  }
}
```

#### 10. Get Sync Status
**POST** `/api/v1/app/sync/status`

Get sync statistics and last sync time:

Request body:
```json
{}
```

Response:
```json
{
  "success": true,
  "message": "Sync status retrieved successfully",
  "data": {
    "counts": {
      "attendance": 150,
      "gpsHistory": 5420,
      "visits": 45,
      "orders": 32,
      "payments": 28,
      "feedback": 18,
      "images": 120
    },
    "lastSyncTime": "2026-05-30T11:30:00Z"
  }
}
```

## Response Format

### Success Response
All sync endpoints return standardized responses:

```json
{
  "success": true,
  "message": "Data synced successfully",
  "data": {
    "success": [
      {
        "localId": "att_001",
        "serverId": 123
      }
    ],
    "updated": [
      {
        "localId": "att_002",
        "serverId": 124
      }
    ],
    "failed": [
      {
        "localId": "att_003",
        "error": "Validation error message"
      }
    ]
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Sync Flow

### Initial Sync (New Record)
1. Android app creates record with `local_id` (e.g., "att_001")
2. App sends record to server via sync endpoint
3. Server creates new record and returns `serverId`
4. App stores `serverId` mapping: `{localId: "att_001", serverId: 123}`

### Subsequent Sync (Update)
1. App modifies record locally
2. App sends record with `localId` to server
3. Server finds existing record by `userId` + `localId`
4. Server updates record and returns confirmation
5. App receives `updated` array with mapping

### Conflict Resolution
- **Last-Write-Wins**: Server timestamp takes precedence
- **Server Updates**: Use `/sync/get-updates` to pull server changes
- **Bidirectional**: App should sync up then sync down

## Authentication

All sync endpoints require JWT authentication:

```
Authorization: Bearer <token>
```

The `userId` is automatically extracted from the JWT token, so no need to include it in request body.

## Rate Limiting

App routes (including sync) are rate limited to:
- 300 requests per 15 minutes per IP

## Migration Instructions

### Step 1: Rename Existing Tables
```bash
npm run db:migrate
```

This will:
1. Rename `users` to `wd_users`
2. Rename `inquiries` to `wd_inquiries`
3. Create all new sync tables

### Step 2: Verify Tables
```sql
SHOW TABLES LIKE 'wd_%';
```

Expected output:
```
wd_users
wd_inquiries
wd_attendance
wd_gps_history
wd_visits
wd_orders
wd_payments
wd_feedback
wd_images
```

### Step 3: Test Sync Endpoints
1. Import Postman collection: `Workdesk24_API.postman_collection.json`
2. Login to get JWT token
3. Test individual sync endpoints
4. Test bulk sync endpoint
5. Test get-updates and status endpoints

## Implementation Files

### Models
- `src/models/attendance.js`
- `src/models/gpsHistory.js`
- `src/models/visit.js`
- `src/models/order.js`
- `src/models/payment.js`
- `src/models/feedback.js`
- `src/models/image.js`

### Migrations
- `src/migrations/20260530100001-rename-tables-with-prefix.js`
- `src/migrations/20260530100002-create-attendance.js`
- `src/migrations/20260530100003-create-gps-history.js`
- `src/migrations/20260530100004-create-visits.js`
- `src/migrations/20260530100005-create-orders.js`
- `src/migrations/20260530100006-create-payments.js`
- `src/migrations/20260530100007-create-feedback.js`
- `src/migrations/20260530100008-create-images.js`

### Services
- `src/services/syncService.js` - Core sync logic

### Controllers
- `src/controllers/syncController.js` - Request handlers

### Routes
- `src/routes/v1/app/sync.js` - Sync endpoints
- Updated `src/routes/v1/app/index.js` - Mounted sync routes

## Notes

1. **Image Handling**: Images can be synced as base64 data. Consider implementing file upload endpoint for large images in production.

2. **GPS History**: High volume of records expected. Consider implementing batch cleanup/archival strategy.

3. **Offline Support**: Android app should queue sync requests and retry on network failure.

4. **Security**: All endpoints validate JWT token. Server automatically associates records with authenticated user.

5. **Scalability**: For large deployments, consider:
   - Pagination for get-updates endpoint
   - Background job processing for bulk syncs
   - CDN for image storage
   - Database partitioning for GPS history

## Testing

See Postman collection for detailed examples of all endpoints with sample data.

## Support

For issues or questions, refer to the main project documentation or contact the development team.
