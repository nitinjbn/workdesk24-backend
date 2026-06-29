# Reporting API Help

This document explains report APIs, payload format, dynamic filters, nested User filters, and sorting options.

## 1) Endpoints

### Admin
- POST /api/v1/admin/reports/getGPSHistory
- POST /api/v1/admin/reports/getAttendance

### App
- POST /api/v1/app/reports/getGPSHistory
- POST /api/v1/app/reports/getAttendance

## 2) Common Payload Format

You can send filters at top-level or inside `filter`.

```json
{
  "hostId": 1,
  "page": 1,
  "limit": 10,
  "sortBy": "createdAt",
  "sortOrder": "DESC",
  "filter": {
    "userId": 2,
    "createdAt": {
      "from": 1779042600,
      "to": 1779128999
    }
  }
}
```

### Notes
- `hostId` is required (or resolved from token scope).
- `page` default: `1`
- `limit` default: `10`, max: `100`
- `filter` is optional.

## 3) User Scope Resolution

Effective user scope is selected in this order:
1. App token user (`requestUserId`) if present
2. `filter.User.id` (or `filter.user.id`)
3. `filter.userId` (or top-level `userId`)

Behavior:
- If effective user is present: report is scoped to that user.
- If effective user is not present: active users only (`User.isActive = 1`).

## 4) Dynamic Filter Rules

For any valid model column key:
- Direct value => equality (`=`)
- Object with range keys => range filter

### Range keys supported
- `from` / `to`
- `start` / `end`
- `gte` / `lte`
- `eq`

### Operator object support
- `like` (contains)
- `startsWith`
- `endsWith`
- `in`
- `notIn`
- `ne`

## 5) Main Table Filter Examples

## 5.1) GPS History filters

```json
{
  "filter": {
    "createdAt": { "from": 1779042600, "to": 1779128999 },
    "latitude": { "gte": 28.5, "lte": 29.0 },
    "provider": { "like": "gps" },
    "speed": { "gte": 5 },
    "batteryPercentage": { "in": [20, 30, 40] }
  }
}
```

## 5.2) Attendance filters

```json
{
  "filter": {
    "attendanceTime": { "from": 1779042600, "to": 1779128999 },
    "attendanceStatus": "Present",
    "vehicleType": { "like": "Bike" },
    "attendanceBatteryPercentage": { "gte": 30 },
    "attendanceLocationSpeed": { "lte": 60 }
  }
}
```

## 6) Nested User Filter Examples

Use `filter.User` (preferred) or `filter.user`.

```json
{
  "filter": {
    "User": {
      "id": 30,
      "name": { "like": "Nitin" },
      "email": { "endsWith": "@example.com" },
      "roleId": { "in": [1, 2, 3] },
      "isActive": 1,
      "createdAt": { "from": 1779042600, "to": 1779128999 }
    }
  }
}
```

### User filter quick examples

```json
{ "filter": { "User": { "name": "Nitin Sharma" } } }
```

```json
{ "filter": { "User": { "name": { "startsWith": "Nit" } } } }
```

```json
{ "filter": { "User": { "name": { "endsWith": "Sharma" } } } }
```

```json
{ "filter": { "User": { "name": { "ne": "Test User" } } } }
```

## 7) Sorting Support

Allowed sort fields:
- `createdAt`
- `batteryPercentage`
- `speed`
- `userName`

Allowed sort directions:
- `ASC`
- `DESC`
- `asc`
- `desc`

### Sorting payload style A

```json
{
  "sortBy": "userName",
  "sortOrder": "ASC"
}
```

### Sorting payload style B

```json
{
  "sort": {
    "by": "createdAt",
    "order": "DESC"
  }
}
```

### Sorting field mapping

- GPS report
  - `createdAt` -> `GpsHistory.createdAt`
  - `batteryPercentage` -> `GpsHistory.batteryPercentage`
  - `speed` -> `GpsHistory.speed`
  - `userName` -> `User.name`

- Attendance report
  - `createdAt` -> `Attendance.createdAt`
  - `batteryPercentage` -> `Attendance.attendanceBatteryPercentage`
  - `speed` -> `Attendance.attendanceLocationSpeed`
  - `userName` -> `User.name`

## 8) Full Example: Attendance (Admin)

```json
{
  "hostId": 1,
  "userId": 2,
  "page": 1,
  "limit": 10,
  "sort": {
    "by": "userName",
    "order": "ASC"
  },
  "filter": {
    "attendanceTime": {
      "from": 1779042600,
      "to": 1779128999
    },
    "attendanceStatus": "Present",
    "User": {
      "id": 30,
      "name": { "like": "Nitin" }
    }
  }
}
```

## 9) Full Example: GPS History (Admin)

```json
{
  "hostId": 1,
  "page": 1,
  "limit": 10,
  "sortBy": "speed",
  "sortOrder": "DESC",
  "filter": {
    "userId": 30,
    "createdAt": {
      "from": 1779042600,
      "to": 1779128999
    },
    "provider": { "like": "gps" },
    "User": {
      "name": { "startsWith": "Nit" }
    }
  }
}
```

## 10) Response Format

```json
{
  "success": true,
  "message": "...report retrieved successfully",
  "data": {
    "data": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPreviousPage": false,
      "nextPage": null,
      "previousPage": null
    }
  }
}
```
