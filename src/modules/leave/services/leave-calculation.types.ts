export type LeaveDurationType = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';

export interface RequestedLeaveDay {
  leaveDate: string;
  durationType: LeaveDurationType;
}

export interface LeaveCalculationError {
  code: string;
  message: string;
  field?: string;
  meta?: Record<string, unknown>;
}

export interface LeaveCalculationWarning {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface LeaveDayBreakdown {
  date: string;
  durationDays: number;
  isHoliday: boolean;
  isOptionalHoliday: boolean;
  excludedByHoliday: boolean;
}

export interface LeaveCalculationInput {
  hostId: number;
  userId: number;
  leaveTypeId: number;
  fromDate: string;
  tillDate: string;
  durationType: LeaveDurationType;
  days?: RequestedLeaveDay[];
  selectedOptionalHolidayDates?: string[];
  requestDate?: string;
  excludeLeaveRequestId?: number;
}

export interface LeaveCalculationContextData {
  user?: any;
  leaveType?: any;
  leavePolicy?: any;
  holidayCalendar?: any;
  holidayCalendarSource?: 'USER' | 'DEFAULT';
  leavePolicyRule?: any;
  leaveYear?: any;
  leaveBalance?: any;
}

export interface LeaveCalculationResult {
  isValid: boolean;
  errors: LeaveCalculationError[];
  warnings: LeaveCalculationWarning[];
  totalLeaveDays: number;
  workingDays: number;
  excludedHolidayCount: number;
  dayBreakdown: LeaveDayBreakdown[];
  context: LeaveCalculationContextData;
}
