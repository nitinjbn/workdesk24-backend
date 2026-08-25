import leaveCalculationRepository from '../repositories/leave-calculation.repository';
import leavePolicyService from './leave-policy.service';
import {
  calculateLeaveDayBreakdown,
  compareYmdDate,
  diffDays,
  getTodayYmd,
  isValidYmdDate,
} from './leave-calculation.util';
import {
  LeaveCalculationError,
  LeaveCalculationInput,
  LeaveCalculationResult,
  LeaveCalculationWarning,
  RequestedLeaveDay,
} from './leave-calculation.types';

export class LeaveCalculationService {
  async validateAndCalculateLeave(payload: LeaveCalculationInput): Promise<LeaveCalculationResult> {
    const errors: LeaveCalculationError[] = [];
    const warnings: LeaveCalculationWarning[] = [];

    const baseResult: LeaveCalculationResult = {
      isValid: false,
      errors,
      warnings,
      totalLeaveDays: 0,
      workingDays: 0,
      excludedHolidayCount: 0,
      dayBreakdown: [],
      context: {},
    };

    const {
      hostId,
      userId,
      leaveTypeId,
      fromDate,
      tillDate,
      durationType,
      days,
      selectedOptionalHolidayDates,
      requestDate,
      excludeLeaveRequestId,
    } = payload;

    // 1) Basic date and duration validation
    if (!isValidYmdDate(fromDate)) {
      errors.push({
        code: 'INVALID_DATE_FORMAT',
        message: 'fromDate must be in YYYY-MM-DD format',
        field: 'fromDate',
      });
    }

    if (!isValidYmdDate(tillDate)) {
      errors.push({
        code: 'INVALID_DATE_FORMAT',
        message: 'tillDate must be in YYYY-MM-DD format',
        field: 'tillDate',
      });
    }

    if (isValidYmdDate(fromDate) && isValidYmdDate(tillDate) && compareYmdDate(fromDate, tillDate) > 0) {
      errors.push({
        code: 'INVALID_DATE_RANGE',
        message: 'fromDate must be before or equal to tillDate',
        field: 'fromDate',
      });
    }

    if (!['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'].includes(durationType)) {
      errors.push({
        code: 'INVALID_DURATION_TYPE',
        message: 'durationType must be FULL_DAY, FIRST_HALF, or SECOND_HALF',
        field: 'durationType',
      });
    }

    const requestedDaySpan =
      isValidYmdDate(fromDate) && isValidYmdDate(tillDate) ? diffDays(fromDate, tillDate) + 1 : 0;

    if (requestedDaySpan > 1 && durationType !== 'FULL_DAY') {
      errors.push({
        code: 'INVALID_DURATION_FOR_RANGE',
        message: 'FIRST_HALF or SECOND_HALF is only allowed for single-day leave',
        field: 'durationType',
      });
    }

    if (days !== undefined) {
      if (!Array.isArray(days)) {
        errors.push({
          code: 'INVALID_INPUT',
          message: 'days must be an array',
          field: 'days',
        });
      } else {
        const seenDates = new Set<string>();
        for (let i = 0; i < days.length; i++) {
          const day = days[i] as RequestedLeaveDay;
          if (!day || !day.leaveDate || !day.durationType) {
            errors.push({
              code: 'INVALID_INPUT',
              message: `days[${i}] must contain leaveDate and durationType`,
              field: `days[${i}]`,
            });
            continue;
          }

          if (!isValidYmdDate(day.leaveDate)) {
            errors.push({
              code: 'INVALID_DATE_FORMAT',
              message: `days[${i}].leaveDate must be in YYYY-MM-DD format`,
              field: `days[${i}].leaveDate`,
            });
          }

          if (!['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'].includes(day.durationType)) {
            errors.push({
              code: 'INVALID_DURATION_TYPE',
              message: `days[${i}].durationType must be FULL_DAY, FIRST_HALF, or SECOND_HALF`,
              field: `days[${i}].durationType`,
            });
          }

          if (seenDates.has(day.leaveDate)) {
            errors.push({
              code: 'DUPLICATE_LEAVE_DAY',
              message: `Duplicate leaveDate found in days: ${day.leaveDate}`,
              field: `days[${i}].leaveDate`,
            });
          }
          seenDates.add(day.leaveDate);

          if (
            isValidYmdDate(day.leaveDate) &&
            (compareYmdDate(day.leaveDate, fromDate) < 0 || compareYmdDate(day.leaveDate, tillDate) > 0)
          ) {
            errors.push({
              code: 'LEAVE_DAY_OUT_OF_RANGE',
              message: `days[${i}].leaveDate must be within fromDate and tillDate`,
              field: `days[${i}].leaveDate`,
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      return baseResult;
    }

    // 2) Resolve employee + leave configuration
    const user = await leaveCalculationRepository.getUserWithLeaveConfig(hostId, userId);
    if (!user) {
      errors.push({
        code: 'USER_NOT_FOUND',
        message: 'User not found for this organization',
        field: 'userId',
      });
      return baseResult;
    }

    const userPlain = user.toJSON();
    baseResult.context.user = userPlain;

    const userHolidayCalendarId = (userPlain as any).holidayCalendarId;

    const userHolidayCalendar = (userPlain as any).holidayCalendar;

    // 3) Resolve leave year by date (both dates must belong to the same year)
    const leaveYearForFromDate = await leaveCalculationRepository.resolveLeaveYearForDate(hostId, fromDate);
    const leaveYearForTillDate = await leaveCalculationRepository.resolveLeaveYearForDate(hostId, tillDate);

    if (!leaveYearForFromDate || !leaveYearForTillDate) {
      errors.push({
        code: 'LEAVE_YEAR_NOT_FOUND',
        message: 'Leave year could not be resolved for requested dates',
        field: 'fromDate',
      });
    } else if (Number((leaveYearForFromDate as any).id) !== Number((leaveYearForTillDate as any).id)) {
      errors.push({
        code: 'CROSS_LEAVE_YEAR_NOT_ALLOWED',
        message: 'Leave request cannot span across different leave years',
        field: 'tillDate',
      });
    } else {
      baseResult.context.leaveYear = leaveYearForFromDate.toJSON();
    }

    const leaveYearData = baseResult.context.leaveYear as any;

    // Resolve holiday calendar from user.holidayCalendarId with host default fallback
    let effectiveHolidayCalendar: any = null;
    let holidayCalendarSource: 'USER' | 'DEFAULT' | null = null;

    if (leaveYearData) {
      if (userHolidayCalendarId) {
        if (!userHolidayCalendar) {
          errors.push({
            code: 'HOLIDAY_CALENDAR_NOT_FOUND',
            message: 'Configured holiday calendar is not available for this organization',
            field: 'holidayCalendarId',
          });
        } else if (Number(userHolidayCalendar.isEnabled) !== 1) {
          errors.push({
            code: 'HOLIDAY_CALENDAR_DISABLED',
            message: 'Configured holiday calendar is disabled',
            field: 'holidayCalendarId',
          });
        } else if (Number(userHolidayCalendar.leaveYearId || 0) !== Number(leaveYearData.id)) {
          errors.push({
            code: 'HOLIDAY_CALENDAR_LEAVE_YEAR_MISMATCH',
            message: 'Employee holiday calendar is linked to a different leave year',
            field: 'holidayCalendarId',
            meta: {
              holidayCalendarLeaveYearId: Number(userHolidayCalendar.leaveYearId || 0),
              requestLeaveYearId: Number(leaveYearData.id),
            },
          });
        } else {
          effectiveHolidayCalendar = userHolidayCalendar;
          holidayCalendarSource = 'USER';
        }
      } else {
        const defaultHolidayCalendar =
          await leaveCalculationRepository.getDefaultHolidayCalendarByLeaveYear(
            hostId,
            Number(leaveYearData.id)
          );

        if (!defaultHolidayCalendar) {
          errors.push({
            code: 'MISSING_EMPLOYEE_HOLIDAY_CALENDAR',
            message:
              'Employee holidayCalendarId is not configured and no default holiday calendar exists for the leave year',
            field: 'holidayCalendarId',
            meta: {
              leaveYearId: Number(leaveYearData.id),
            },
          });
        } else {
          effectiveHolidayCalendar =
            defaultHolidayCalendar && typeof defaultHolidayCalendar.toJSON === 'function'
              ? defaultHolidayCalendar.toJSON()
              : defaultHolidayCalendar;
          holidayCalendarSource = 'DEFAULT';
        }
      }
    }

    if (effectiveHolidayCalendar) {
      baseResult.context.holidayCalendar = effectiveHolidayCalendar;
      (baseResult.context as any).holidayCalendarSource = holidayCalendarSource;
    }

    // 4-5) Resolve leave policy, rule, and leave type via centralized policy service
    try {
      const resolvedPolicy = await leavePolicyService.resolveEmployeeLeavePolicyRule({
        hostId,
        userId,
        leaveTypeId,
      });

      baseResult.context.leavePolicy = resolvedPolicy.leavePolicy;
      baseResult.context.leavePolicyRule =
        resolvedPolicy.leavePolicyRule && typeof resolvedPolicy.leavePolicyRule.toJSON === 'function'
          ? resolvedPolicy.leavePolicyRule.toJSON()
          : resolvedPolicy.leavePolicyRule;
      baseResult.context.leaveType =
        resolvedPolicy.leaveType && typeof resolvedPolicy.leaveType.toJSON === 'function'
          ? resolvedPolicy.leaveType.toJSON()
          : resolvedPolicy.leaveType;
    } catch (error: any) {
      errors.push({
        code: error?.code || 'LEAVE_REQUEST_VALIDATION_FAILED',
        message: error?.message || 'Leave policy resolution failed',
        field: 'leavePolicyId',
      });
    }

    if (errors.length > 0) {
      return baseResult;
    }

    const leaveTypeData = baseResult.context.leaveType as any;
    const leavePolicyRuleData = baseResult.context.leavePolicyRule as any;

    // 6-8) Working day calculation + holiday handling
    const holidays = await leaveCalculationRepository.getHolidaysBetween({
      hostId,
      holidayCalendarId: Number((effectiveHolidayCalendar as any).id),
      fromDate,
      tillDate,
    });

    const holidayPlain = holidays.map((h: any) => (h && typeof h.toJSON === 'function' ? h.toJSON() : h));

    const dayCalc = calculateLeaveDayBreakdown({
      fromDate,
      tillDate,
      durationType,
      requestedDays: days,
      holidays: holidayPlain,
      selectedOptionalHolidayDates,
    });

    baseResult.totalLeaveDays = dayCalc.totalLeaveDays;
    baseResult.workingDays = dayCalc.workingDays;
    baseResult.excludedHolidayCount = dayCalc.excludedHolidayCount;
    baseResult.dayBreakdown = dayCalc.dayBreakdown;

    if (Array.isArray(days) && days.length > 0) {
      const invalidHolidayDays = days.filter((day) => {
        const entry = dayCalc.dayBreakdown.find((item) => item.date === day.leaveDate);
        return !!entry && entry.excludedByHoliday;
      });

      if (invalidHolidayDays.length > 0) {
        errors.push({
          code: 'LEAVE_DAY_ON_EXCLUDED_HOLIDAY',
          message: 'One or more leave days fall on excluded holidays',
          field: 'days',
          meta: {
            dates: invalidHolidayDays.map((day) => day.leaveDate),
          },
        });
      }
    }

    const selectedOptionalSet = new Set(selectedOptionalHolidayDates || []);
    const optionalHolidayInRange = holidayPlain.filter((h: any) => Number(h.isOptional) === 1);
    const optionalExcluded = optionalHolidayInRange.filter((h: any) =>
      selectedOptionalSet.has(h.holidayDate)
    );

    if (optionalHolidayInRange.length > 0 && optionalExcluded.length === 0) {
      warnings.push({
        code: 'OPTIONAL_HOLIDAYS_NOT_EXCLUDED',
        message:
          'Optional holidays exist in the date range but none were selected for exclusion',
        meta: {
          optionalHolidayDates: optionalHolidayInRange.map((h: any) => h.holidayDate),
        },
      });
    }

    // 10-15) Rule validations and date-based validations
    const today = requestDate && isValidYmdDate(requestDate) ? requestDate : getTodayYmd();
    const startDeltaFromToday = diffDays(today, fromDate);

    if (Number(leaveTypeData.allowPastDate) !== 1 && compareYmdDate(fromDate, today) < 0) {
      errors.push({
        code: 'PAST_DATE_NOT_ALLOWED',
        message: 'This leave type does not allow applying leave for past dates',
        field: 'fromDate',
      });
    }

    if (Number(leaveTypeData.allowFutureDate) !== 1 && compareYmdDate(fromDate, today) > 0) {
      errors.push({
        code: 'FUTURE_DATE_NOT_ALLOWED',
        message: 'This leave type does not allow applying leave for future dates',
        field: 'fromDate',
      });
    }

    const minimumNoticeDays = Number(leavePolicyRuleData.minimumNoticeDays || 0);
    if (compareYmdDate(fromDate, today) >= 0 && startDeltaFromToday < minimumNoticeDays) {
      errors.push({
        code: 'MINIMUM_NOTICE_DAYS_NOT_MET',
        message: `Minimum notice of ${minimumNoticeDays} day(s) is required`,
        field: 'fromDate',
        meta: {
          minimumNoticeDays,
          actualNoticeDays: startDeltaFromToday,
        },
      });
    }

    const maximumAdvanceDays = Number(leavePolicyRuleData.maximumAdvanceDays || 0);
    if (
      maximumAdvanceDays > 0 &&
      compareYmdDate(fromDate, today) > 0 &&
      startDeltaFromToday > maximumAdvanceDays
    ) {
      errors.push({
        code: 'MAXIMUM_ADVANCE_DAYS_EXCEEDED',
        message: `Leave cannot be applied more than ${maximumAdvanceDays} day(s) in advance`,
        field: 'fromDate',
        meta: {
          maximumAdvanceDays,
          actualAdvanceDays: startDeltaFromToday,
        },
      });
    }

    const maximumConsecutiveDays = Number(leavePolicyRuleData.maximumConsecutiveDays || 0);
    if (maximumConsecutiveDays > 0 && baseResult.totalLeaveDays > maximumConsecutiveDays) {
      errors.push({
        code: 'MAXIMUM_CONSECUTIVE_DAYS_EXCEEDED',
        message: `Maximum consecutive leave days exceeded: allowed ${maximumConsecutiveDays}, requested ${baseResult.totalLeaveDays}`,
        field: 'tillDate',
        meta: {
          maximumConsecutiveDays,
          requestedDays: baseResult.totalLeaveDays,
        },
      });
    }

    // 16) Validate available balance
    const leaveBalance = await leaveCalculationRepository.getLeaveBalance({
      hostId,
      userId,
      leaveYearId: Number(leaveYearData.id),
      leaveTypeId,
    });

    const leaveBalancePlain =
      leaveBalance && typeof leaveBalance.toJSON === 'function'
        ? leaveBalance.toJSON()
        : leaveBalance;

    baseResult.context.leaveBalance = leaveBalancePlain || null;

    const availableBalance = leaveBalancePlain ? Number(leaveBalancePlain.availableBalance || 0) : 0;
    const allowNegativeBalance = Number(leavePolicyRuleData.allowNegativeBalance || 0) === 1;

    if (!allowNegativeBalance && baseResult.totalLeaveDays > availableBalance) {
      errors.push({
        code: 'INSUFFICIENT_LEAVE_BALANCE',
        message: 'Insufficient leave balance for requested duration',
        field: 'totalLeaveDays',
        meta: {
          availableBalance,
          requestedDays: baseResult.totalLeaveDays,
        },
      });
    }

    // 17) Validate overlapping leave requests
    const overlappingRequests = await leaveCalculationRepository.findOverlappingLeaveRequests({
      hostId,
      userId,
      fromDate,
      tillDate,
      excludeLeaveRequestId,
    });

    if (overlappingRequests.length > 0) {
      errors.push({
        code: 'OVERLAPPING_LEAVE_REQUEST_EXISTS',
        message: 'Overlapping leave request already exists for the employee',
        field: 'fromDate',
        meta: {
          overlappingRequestIds: overlappingRequests.map((item: any) => item.id),
        },
      });
    }

    // 18-19) Finalize total days and detailed result
    if (baseResult.totalLeaveDays <= 0) {
      errors.push({
        code: 'NO_WORKING_DAYS_IN_RANGE',
        message: 'No applicable leave days found after holiday exclusions',
        field: 'fromDate',
      });
    }

    const calendarLeaveYearId = Number((effectiveHolidayCalendar as any).leaveYearId || 0);
    if (calendarLeaveYearId && calendarLeaveYearId !== Number((leaveYearData as any).id)) {
      errors.push({
        code: 'HOLIDAY_CALENDAR_LEAVE_YEAR_MISMATCH',
        message: 'Employee holiday calendar is linked to a different leave year',
        field: 'holidayCalendarId',
        meta: {
          holidayCalendarLeaveYearId: calendarLeaveYearId,
          requestLeaveYearId: Number((leaveYearData as any).id),
        },
      });
    }

    baseResult.isValid = errors.length === 0;
    return baseResult;
  }
}

export default new LeaveCalculationService();
