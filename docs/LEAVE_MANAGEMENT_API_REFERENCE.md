# Leave Management API Reference

This document covers leave APIs currently implemented under the v1 routes.

## 1. Route List

### Employee App APIs (authenticated app user)
Base path: `/v1/app/leave`

- `POST /getSummary`
- `POST /getBalances`
- `POST /getBalancesByLeaveYear`
- `POST /getLeaveTypes`
- `POST /getHolidays`
- `POST /getRequests`
- `POST /getRequestById`
- `POST /createRequest`
- `POST /submitRequest`
- `POST /cancelRequest`
- `POST /withdrawRequest`

### Admin APIs (authenticated admin + CSRF)
Base path: `/v1/admin`

- Leave Year:
  - `POST /getLeaveYears`
  - `POST /getLeaveYearById`
  - `POST /createLeaveYear`
  - `POST /updateLeaveYear`
  - `POST /deleteLeaveYear`
- Holiday Calendar:
  - `POST /getHolidayCalendars`
  - `POST /getHolidayCalendarById`
  - `POST /createHolidayCalendar`
  - `POST /updateHolidayCalendar`
  - `POST /enableDisableHolidayCalendar`
  - `POST /setHolidayCalendarAsDefault`
  - `POST /deleteHolidayCalendar`
- Holiday:
  - `POST /getHolidaysByCalendar`
  - `POST /getHolidayById`
  - `POST /createHoliday`
  - `POST /updateHoliday`
  - `POST /enableDisableHoliday`
  - `POST /deleteHoliday`
  - `POST /bulkCreateHolidays`
- Leave Type:
  - `POST /getLeaveTypes`
  - `POST /getLeaveTypeById`
  - `POST /createLeaveType`
  - `POST /updateLeaveType`
  - `POST /enableDisableLeaveType`
  - `POST /deleteLeaveType`
- Leave Policy:
  - `POST /createLeavePolicy`
  - `POST /getLeavePolicies`
  - `POST /getLeavePolicyById`
  - `POST /updateLeavePolicy`
  - `POST /enableDisableLeavePolicy`
  - `POST /deleteLeavePolicy`
  - `POST /setLeavePolicyAsDefault`
- Leave Policy Rules:
  - `POST /addLeaveTypeRule`
  - `POST /updateLeaveTypeRule`
  - `POST /deleteLeaveTypeRule`
  - `POST /getLeavePolicyRules`
- Employee Leave Config:
  - `POST /getEmployeeLeaveConfiguration`
  - `POST /updateEmployeeLeaveConfiguration`
  - `POST /bulkUpdateEmployeeLeaveConfiguration`
- Leave Balance:
  - `POST /getEmployeeLeaveBalances`
  - `POST /getEmployeeBalanceForLeaveYear`
  - `POST /getBalanceByLeaveType`
  - `POST /getBalanceTransactionHistory`
  - `POST /manualBalanceAdjustment`
- Leave Request Approval:
  - `POST /getPendingLeaveRequests`
  - `POST /getLeaveRequestDetails`
  - `POST /approveLeaveRequest`
  - `POST /rejectLeaveRequest`
  - `POST /cancelLeaveRequestByApprover`
  - `POST /getLeaveRequestApprovalHistory`

## 2. Request Schemas

All bodies are JSON and all routes are POST.

### 2.1 Employee request lifecycle

`POST /v1/app/leave/createRequest`
```json
{
  "leaveTypeId": 10,
  "fromDate": "2026-08-25",
  "tillDate": "2026-08-25",
  "reason": "Medical leave",
  "requestLocalId": "mobile-1724589912-1",
  "days": [
    { "leaveDate": "2026-08-25", "durationType": "FULL_DAY" }
  ]
}
```

`POST /v1/app/leave/submitRequest`
```json
{ "id": 123 }
```

`POST /v1/app/leave/cancelRequest`
```json
{ "id": 123 }
```

`POST /v1/app/leave/withdrawRequest`
```json
{ "id": 123 }
```

### 2.2 Employee read APIs

`POST /v1/app/leave/getHolidays`
```json
{ "leaveYearId": 2 }
```

`POST /v1/app/leave/getRequests`
```json
{
  "filter": {
    "status": "PENDING",
    "leaveYearId": 2
  },
  "page": 1,
  "limit": 20,
  "sortBy": "submittedAt",
  "sortOrder": "DESC"
}
```

`POST /v1/app/leave/getRequestById`
```json
{ "id": 123 }
```

### 2.3 Approval APIs

`POST /v1/admin/approveLeaveRequest`
```json
{
  "leaveRequestId": 123,
  "comment": "Approved by manager"
}
```

`POST /v1/admin/rejectLeaveRequest`
```json
{
  "leaveRequestId": 123,
  "comment": "Insufficient notice"
}
```

`POST /v1/admin/cancelLeaveRequestByApprover`
```json
{
  "leaveRequestId": 123,
  "comment": "Cancelled after business update"
}
```

`POST /v1/admin/getPendingLeaveRequests`
```json
{
  "filter": {
    "userId": 501,
    "leaveTypeId": 10,
    "leaveYearId": 2
  },
  "page": 1,
  "limit": 20,
  "sortBy": "submittedAt",
  "sortOrder": "DESC"
}
```

## 3. Response Schemas

Common envelope:
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Error envelope:
```json
{
  "success": false,
  "message": "Error message"
}
```

### 3.1 Leave request details shape
Used by employee and approver detail/history endpoints.

```json
{
  "request": {
    "id": 123,
    "hostId": 7,
    "userId": 501,
    "leaveYearId": 2,
    "leaveTypeId": 10,
    "status": "PENDING",
    "fromDate": "2026-08-25",
    "tillDate": "2026-08-25",
    "totalDays": 1,
    "reason": "Medical leave",
    "submittedAt": 1724589980,
    "approvedAt": null,
    "rejectedAt": null,
    "cancelledAt": null,
    "withdrawnAt": null,
    "days": [
      {
        "id": 77,
        "leaveDate": "2026-08-25",
        "durationType": "FULL_DAY",
        "durationDays": 1
      }
    ],
    "approvals": [
      {
        "id": 556,
        "action": "SUBMITTED",
        "previousStatus": "DRAFT",
        "newStatus": "PENDING",
        "comment": "Request submitted by employee",
        "approverUserId": 501,
        "createdAt": 1724589980
      }
    ]
  }
}
```

### 3.2 Holiday response shape
```json
{
  "holidayCalendar": {
    "id": 9,
    "name": "HQ Calendar",
    "leaveYearId": 2,
    "source": "USER"
  },
  "holidays": [
    {
      "id": 111,
      "holidayDate": "2026-08-15",
      "name": "Independence Day",
      "isOptional": 0
    }
  ]
}
```

### 3.3 List + pagination shape
```json
{
  "requests": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 245,
    "pages": 13
  }
}
```

## 4. Validation Rules

### 4.1 Lifecycle/status transition

- Allowed leave request transitions:
  - `DRAFT -> PENDING, CANCELLED`
  - `PENDING -> APPROVED, REJECTED, WITHDRAWN, CANCELLED`
  - `APPROVED -> CANCELLED`
  - `REJECTED`, `CANCELLED`, `WITHDRAWN` are terminal
- Invalid transitions return `INVALID_REQUEST_STATUS_TRANSITION`.

### 4.2 Create/submit validation

- `leaveTypeId`, `fromDate`, `tillDate`, and non-empty `days` are required for create.
- Date format must be `YYYY-MM-DD`.
- Leave calculations enforce:
  - leave year resolution,
  - holiday calendar resolution from `wd_users.holidayCalendarId`, with default fallback,
  - leave policy/rule resolution from `wd_users.leavePolicyId`,
  - holiday exclusion,
  - overlap checks,
  - balance checks.
- Overlapping requests return `OVERLAPPING_LEAVE_REQUEST_EXISTS`.
- No workable days after holiday filtering returns `NO_WORKING_DAYS_IN_RANGE`.

### 4.3 Pagination/sorting safety

- Pagination is capped centrally (max limit 200, default 20).
- Sort fields are allowlisted per repository (unsafe fields are not accepted).

### 4.4 Approval authorization

- Approver must be either:
  - admin role, or
  - reporting manager of the request owner.
- Otherwise `LEAVE_APPROVER_NOT_AUTHORIZED`.

### 4.5 Multi-tenant and soft delete safety

- All main and included entities are host-scoped (`hostId`) and filtered for active/non-deleted records where expected.

## 5. Error Codes And Messages

Canonical source: `src/config/error.json`.

Most important leave-management errors:

- `LEAVE_YEAR_NOT_FOUND`: Leave year not found.
- `INVALID_DATE_FORMAT`: Date must be in YYYY-MM-DD format.
- `INVALID_DATE_RANGE`: Start date must be before or equal to end date.
- `HOLIDAY_CALENDAR_NOT_FOUND`: Holiday calendar not found.
- `MISSING_EMPLOYEE_HOLIDAY_CALENDAR`: Employee holiday calendar is not configured.
- `HOLIDAY_CALENDAR_LEAVE_YEAR_MISMATCH`: Employee holiday calendar is linked to a different leave year.
- `LEAVE_TYPE_NOT_FOUND`: Leave type not found.
- `LEAVE_POLICY_NOT_FOUND`: Leave policy not found.
- `LEAVE_TYPE_DISABLED_OR_NOT_FOUND`: Leave type not found or not enabled for this organization.
- `LEAVE_BALANCE_NOT_FOUND`: Leave balance not found.
- `INVALID_BALANCE_CHANGE`: Invalid leave balance change request.
- `NEGATIVE_BALANCE_NOT_ALLOWED`: Negative leave balance is not allowed by policy rule.
- `LEAVE_REQUEST_NOT_FOUND`: Leave request not found.
- `INVALID_REQUEST_STATUS_TRANSITION`: Invalid leave request status transition.
- `INSUFFICIENT_LEAVE_BALANCE`: Insufficient leave balance for requested leave days.
- `OVERLAPPING_LEAVE_REQUEST_EXISTS`: Overlapping leave request already exists.
- `LEAVE_REQUEST_VALIDATION_FAILED`: Leave request validation failed.
- `LEAVE_APPROVER_NOT_AUTHORIZED`: You are not authorized to approve/reject/cancel this leave request.
- `USER_NOT_FOUND`: User not found.
- `INVALID_INPUT`: Invalid input provided.

## 6. Authentication Requirements

### App leave APIs

- Middleware: `authMiddleware`
- Required: valid app/user JWT
- No CSRF requirement on app leave routes

### Admin leave APIs

- Middleware chain:
  - `authMiddleware`
  - `requireAdminRole`
  - `requireAdminCsrfToken`
- Required headers/cookies:
  - admin JWT/session (as configured in auth middleware)
  - `x-csrf-token` header matching admin CSRF cookie

## 7. Permissions Matrix (Admin vs Employee)

- Employee:
  - Can read own leave summary/balances/types/holidays/requests.
  - Can create request (currently persisted directly as `PENDING`).
  - Can submit only `DRAFT` request.
  - Can cancel own `DRAFT` or `PENDING` request.
  - Can withdraw own `PENDING` request.
- Admin:
  - Full leave master/config access (year/calendar/holiday/type/policy/rules/config/balance).
  - Leave approval actions are allowed only if admin role or reporting-manager relation.
  - Non-admin manager listing of pending requests is scoped to direct reports.

## 8. Postman Examples

A runnable collection is included in:

- `docs/LEAVE_MANAGEMENT.postman_collection.json`

It includes:

- employee get leave types
- employee get holidays
- employee create leave request
- employee list own requests
- admin list pending requests
- admin approve request
- admin reject request
- admin cancel approved request
- admin request approval history

## 9. Tests Added

### 9.1 Unit tests for leave calculations

- File: `tests/leave/leave-calculation.unit.test.js`
- Covers:
  - date validation
  - date comparison and range expansion
  - holiday exclusion
  - optional holiday behavior
  - half-day handling

### 9.2 Integration tests for request lifecycle

- File: `tests/leave/leave-request-lifecycle.integration.test.js`
- Uses real service + repository stack and checks:
  - create (PENDING)
  - approve (pending->used balance transfer)
  - cancel after approval (used reversal)
  - reject pending request
  - withdraw pending request

### 9.3 Concurrency/idempotency tests

- File: `tests/leave/leave-concurrency-idempotency.integration.test.js`
- Uses concurrent `Promise.all` calls and checks:
  - duplicate `requestLocalId` returns same request
  - duplicate concurrent approvals do not double-debit
  - approval history contains a single APPROVED audit entry

## 10. How To Run Tests

Required environment variables for integration/concurrency tests:

- `LEAVE_TEST_HOST_ID`
- `LEAVE_TEST_EMPLOYEE_USER_ID`
- `LEAVE_TEST_ADMIN_USER_ID`
- `LEAVE_TEST_ADMIN_ROLE_ID`

Commands:

- `npm run test:leave:unit`
- `npm run test:leave:lifecycle`
- `npm run test:leave:concurrency`
- `npm run test:leave`

Note: Integration and concurrency tests execute against real DB-backed services and mutate leave records/balances for the configured test user.
