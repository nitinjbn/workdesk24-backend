export interface LeaveYearAttributes {
  id: number;
  hostId: number;
  year: number;
  startDate: string; // Start date of the leave year in YYYY-MM-DD format
  endDate: string; // End date of the leave year in YYYY-MM-DD format
  createdAt: number; // Timestamp when the leave year was created
  updatedAt?: number; // Timestamp when the leave year was last updated
  isDeleted: number; // Indicates if the leave year is deleted (1 for deleted, 0 for not deleted)
  deletedAt?: number | null; // Timestamp when the leave year was deleted (if applicable)
}

export interface LeaveTypeAttributes {
  id: number;
  hostId: number;
  name: string; // Name of the leave type (e.g., "Sick Leave", "Casual Leave")
  code: string; // Unique code for the leave type (e.g., "SL", "CL")
  description?: string; // Optional description of the leave type
  isPaid: number; // Indicates if the leave type is paid (1 for paid, 0 for unpaid)
  allowHalfDay: number; // Indicates if half-day leave is allowed (1 for allowed, 0 for not allowed)
  allowPastDate: number; // Indicates if leave can be applied for past dates (1 for allowed, 0 for not allowed)
  allowFutureDate: number; // Indicates if leave can be applied for future dates (1 for allowed, 0 for not allowed)
  requiresDocument: number; // Indicates if a supporting document is required for the leave type (1 for required, 0 for not required)
  documentAfterDays?: number;
  color?: string;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface LeavePolicyAttributes {
  id: number;
  hostId: number;
  name: string;
  description?: string;
  effectiveFrom: string; // Start date of the leave policy in YYYY-MM-DD format
  effectiveTill?: string; // End date of the leave policy in YYYY-MM-DD format (optional)
  isDefault: number;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface LeavePolicyRuleAttributes {
  id: number;
  hostId: number;
  leavePolicyId: number;
  leaveTypeId: number;
  annualEntitlement: number; // Total number of leave days allocated for the leave type in a year
  accrualType: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
  allowCarryForward: number; // Indicates if unused leave can be carried forward to the next year (1 for allowed, 0 for not allowed)
  maxCarryForward: number; // Maximum number of leave days that can be carried forward to the next year
  allowEncashment: number; // Indicates if unused leave can be encashed (1 for allowed, 0 for not allowed)
  allowHalfDay: number; // Indicates if half-day leave is allowed (1 for allowed, 0 for not allowed)
  minimumNoticeDays: number; // Minimum number of notice days required before applying for leave
  maximumAdvanceDays: number; // Maximum number of days in advance leave can be applied for
  maximumConsecutiveDays: number; // Maximum number of consecutive leave days allowed
  allowNegativeBalance: number; // Indicates if negative leave balance is allowed (1 for allowed, 0 for not allowed)
  requiresApproval: number; // Indicates if leave requires approval (1 for required, 0 for not required)
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface LeavePolicyAssignmentAttributes {
  id: number;
  hostId: number;
  userId: number;
  leavePolicyId: number;
  effectiveFrom: number;
  effectiveTill?: number;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

export interface LeaveBalanceAttributes {
  id: number;
  hostId: number;
  userId: number;
  leaveTypeId: number;
  leaveYearId: number;
  allocatedBalance: number; // Total allocated leave balance for the year
  accruedBalance: number; // Leave balance accrued based on the accrual type and period
  carriedForwardBalance: number; // Leave balance carried forward from the previous year, if applicable
  usedBalance: number; // Total leave balance used by the employee for the year
  pendingBalance: number; // Leave balance that is pending approval or processing
  expiredBalance: number; // Leave balance that has expired and is no longer available for use
  availableBalance: number; // Leave balance that is currently available for the employee to use
  createdAt: number;
  updatedAt?: number | null;
  isDeleted: number;
  deletedAt?: number | null;
}

export interface LeaveBalanceTransactionAttributes {
  id: number;
  hostId: number;
  userId: number;
  leaveTypeId: number;
  leaveYearId: number;
  transactionType:
    | 'OPENING'
    | 'ALLOCATION'
    | 'ACCRUAL'
    | 'CARRY_FORWARD'
    | 'LEAVE_DEBIT'
    | 'LEAVE_REVERSAL'
    | 'ADJUSTMENT'
    | 'EXPIRY'
    | 'ENCASHMENT';
  quantity: number;
  openingBalance: number;
  closingBalance: number;
  reason?: string;
  createdBy?: number;
  createdAt: number;
}

export interface LeaveRequestAttributes {
  id: number;
  hostId: number;
  userId: number;
  leaveTypeId: number;
  leaveYearId: number;
  fromDate: string;
  tillDate: string;
  totalDays: number;
  reason?: string;
  status:
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'WITHDRAWN';
  requestLocalId?: string;
  submittedAt?: number;
  approvedAt?: number;
  rejectedAt?: number;
  cancelledAt?: number;
  withdrawnAt?: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: number;
  deletedAt?: number | null;
}

export interface LeaveRequestDayAttributes {
  id: number;
  hostId: number;
  userId: number;
  leaveRequestId: number;
  leaveDate: string;
  durationType:
    | 'FULL_DAY'
    | 'FIRST_HALF'
    | 'SECOND_HALF';
  durationDays: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeaveRequestApprovalAttributes {
  id: number;
  hostId: number;
  leaveRequestId: number;
  approverUserId?: number;
  action:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'WITHDRAWN';
  previousStatus?:
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'WITHDRAWN';
  newStatus:
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'WITHDRAWN';
  comment?: string;
  createdAt: number;
}

export interface HolidayCalendarAttributes {
  id: number;
  hostId: number;
  leaveYearId: number;
  name: string;
  description?: string;
  isDefault: number;
  isEnabled: number;
  isDeleted: number;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt?: number;
}

export interface HolidayAttributes {
  id: number;
  hostId: number;
  holidayCalendarId: number;
  holidayDate: string; // Date of the holiday in YYYY-MM-DD format
  name: string;
  description?: string;
  isOptional: number;
  isEnabled: number;
  isDeleted: number;
  createdBy?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface EmployeeHolidayCalendarAttributes {
  id: number;
  hostId: number;
  userId: number;
  holidayCalendarId: number;
  effectiveFrom: string; // Start date of the holiday calendar in YYYY-MM-DD format
  effectiveTill: string; // End date of the holiday calendar in YYYY-MM-DD format
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}