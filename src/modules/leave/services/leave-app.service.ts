import { sequelize } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings, getDayNameFromDateString } from '../../../shared/utils/date-time-format.util';
import leaveBalanceService from './leave-balance.service';
import leaveCalculationService from './leave-calculation.service';
import leavePolicyService from './leave-policy.service';
import leaveRequestAppRepository from '../repositories/leave-request-app.repository';

export class LeaveAppService {
  async getLeaveSummary(payload: { hostId: number; userId: number }): Promise<any> {
    const { hostId, userId } = payload;

    const user = await leaveRequestAppRepository.getUserWithLeaveConfig(hostId, userId);
    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
    }

    const summary = await leaveRequestAppRepository.getLeaveSummary(hostId, userId);
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      summary,
      user: formatDateTimeFieldsBySettings(user.toJSON(), dateTimeSettings),
    };
  }

  async getLeaveBalances(payload: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const { hostId, userId, filter, page, limit } = payload;

    return leaveBalanceService.getEmployeeLeaveBalances({
      hostId,
      userId,
      filter,
      page,
      limit,
      sortBy: 'leaveYearId',
      sortOrder: 'DESC',
    });
  }

  async getLeaveBalancesByYear(payload: {
    hostId: number;
    userId: number;
    leaveYearId: number;
  }): Promise<any> {
    const { hostId, userId, leaveYearId } = payload;

    return leaveBalanceService.getEmployeeBalanceForLeaveYear({
      hostId,
      userId,
      leaveYearId,
    });
  }

  async getLeaveTypes(payload: { hostId: number; userId: number }): Promise<any> {
    const { hostId, userId } = payload;

    const resolved = await leavePolicyService.resolveEmployeeLeaveTypes({
      hostId,
      userId,
    });

    const rules = resolved.rules;
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    const leaveTypes = rules.map((rule: any) => {
      const rulePlain = rule && typeof rule.toJSON === 'function' ? rule.toJSON() : rule;
      return {
        leaveType: rulePlain.leaveType,
        rule: {
          id: rulePlain.id,
          annualEntitlement: rulePlain.annualEntitlement,
          accrualType: rulePlain.accrualType,
          allowCarryForward: rulePlain.allowCarryForward,
          maxCarryForward: rulePlain.maxCarryForward,
          allowEncashment: rulePlain.allowEncashment,
          allowHalfDay: rulePlain.allowHalfDay,
          minimumNoticeDays: rulePlain.minimumNoticeDays,
          maximumAdvanceDays: rulePlain.maximumAdvanceDays,
          maximumConsecutiveDays: rulePlain.maximumConsecutiveDays,
          allowNegativeBalance: rulePlain.allowNegativeBalance,
          requiresApproval: rulePlain.requiresApproval,
        },
      };
    });

    return {
      leaveTypes: formatDateTimeFieldsBySettings(leaveTypes, dateTimeSettings),
    };
  }

  async getHolidays(payload: { hostId: number; userId: number; leaveYearId?: number }): Promise<any> {
    const { hostId, userId, leaveYearId } = payload;

    const resolved = await leaveRequestAppRepository.resolveEffectiveHolidayCalendarForUser({
      hostId,
      userId,
      leaveYearId,
    });

    if (!resolved.user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!resolved.holidayCalendar) {
      throw createConfiguredError(
        'MISSING_EMPLOYEE_HOLIDAY_CALENDAR',
        'Employee holiday calendar is not configured and no default holiday calendar exists for the leave year',
        400
      );
    }

    const calendar =
      resolved.holidayCalendar && typeof resolved.holidayCalendar.toJSON === 'function'
        ? resolved.holidayCalendar.toJSON()
        : resolved.holidayCalendar;

    const holidays = await leaveRequestAppRepository.getHolidaysByCalendar({
      hostId,
      holidayCalendarId: Number((calendar as any).id),
      leaveYearId: leaveYearId || undefined,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const holidayPlain = holidays.map((item: any) => {
      const plain = item && typeof item.toJSON === 'function' ? item.toJSON() : item;
      return {
        ...plain,
        dayName: plain?.holidayDate ? getDayNameFromDateString(plain.holidayDate) : null,
      };
    });

    return {
      holidayCalendar: {
        id: Number((calendar as any).id),
        name: (calendar as any).name,
        leaveYearId: Number((calendar as any).leaveYearId),
        source: resolved.source,
      },
      holidays: formatDateTimeFieldsBySettings(holidayPlain, dateTimeSettings),
    };
  }

  async getHolidaysV1(payload: { hostId: number; userId: number }): Promise<any> {
    const { hostId, userId } = payload;
    const today = new Date().toISOString().slice(0, 10);
    const currentLeaveYear = await leaveRequestAppRepository.resolveLeaveYearForDate(hostId, today);

    if (!currentLeaveYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'No active leave year found for the current date',
        400
      );
    }

    return this.getHolidays({
      hostId,
      userId,
      leaveYearId: Number((currentLeaveYear as any).id),
    });
  }

  async getLeaveRequests(payload: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = payload;

    const report = await leaveRequestAppRepository.getLeaveRequests({
      hostId,
      userId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const data = report.data.map((item: any) => {
      const plain = item && typeof item.toJSON === 'function' ? item.toJSON() : item;
      return {
        ...plain,
        fromDayName: plain?.fromDate ? getDayNameFromDateString(plain.fromDate) : null,
        tillDayName: plain?.tillDate ? getDayNameFromDateString(plain.tillDate) : null,
      };
    });

    return {
      requests: formatDateTimeFieldsBySettings(data, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLeaveRequestById(payload: { hostId: number; userId: number; leaveRequestId: number }): Promise<any> {
    const { hostId, userId, leaveRequestId } = payload;

    const request = await leaveRequestAppRepository.getLeaveRequestById(hostId, userId, leaveRequestId);
    if (!request) {
      throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
    }

    const [days, approvals] = await Promise.all([
      leaveRequestAppRepository.getLeaveRequestDays(hostId, userId, leaveRequestId),
      leaveRequestAppRepository.getLeaveRequestApprovals(hostId, leaveRequestId),
    ]);

    const requestPlain = request && typeof request.toJSON === 'function' ? request.toJSON() : request;
    const dayPlain = days.map((item: any) => {
      const plain = item && typeof item.toJSON === 'function' ? item.toJSON() : item;
      return {
        ...plain,
        dayName: plain?.leaveDate ? getDayNameFromDateString(plain.leaveDate) : null,
      };
    });
    const approvalPlain = approvals.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      request: formatDateTimeFieldsBySettings(
        {
          ...requestPlain,
          days: dayPlain,
          approvals: approvalPlain,
        },
        dateTimeSettings
      ),
    };
  }

  private async validateRequestByCalculation(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    fromDate: string;
    tillDate: string;
    days: Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }>;
    requestDate?: string;
    excludeLeaveRequestId?: number;
  }): Promise<any> {
    const result = await leaveCalculationService.validateAndCalculateLeave({
      hostId: payload.hostId,
      userId: payload.userId,
      leaveTypeId: payload.leaveTypeId,
      fromDate: payload.fromDate,
      tillDate: payload.tillDate,
      durationType: 'FULL_DAY',
      days: payload.days,
      requestDate: payload.requestDate,
      excludeLeaveRequestId: payload.excludeLeaveRequestId,
    });

    if (!result.isValid) {
      const firstError = result.errors[0];
      throw createConfiguredError(
        firstError?.code || 'LEAVE_REQUEST_VALIDATION_FAILED',
        firstError?.message || 'Leave request validation failed',
        400
      );
    }

    return result;
  }

  private mapLeaveRequestDaysFromInput(payload: {
    days: Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }>;
    dayBreakdown: Array<{ date: string; durationDays: number; excludedByHoliday: boolean }>;
  }): Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'; durationDays: number }> {
    const breakdownMap = new Map<string, { durationDays: number; excludedByHoliday: boolean }>();
    payload.dayBreakdown.forEach((item) => {
      breakdownMap.set(item.date, {
        durationDays: item.durationDays,
        excludedByHoliday: item.excludedByHoliday,
      });
    });

    return payload.days
      .map((day) => {
        const breakdown = breakdownMap.get(day.leaveDate);
        if (!breakdown || breakdown.excludedByHoliday || breakdown.durationDays <= 0) {
          return null;
        }
        return {
          leaveDate: day.leaveDate,
          durationType: day.durationType,
          durationDays: day.durationType === 'FULL_DAY' ? 1 : 0.5,
        };
      })
      .filter((item): item is { leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'; durationDays: number } => !!item);
  }

  async createLeaveRequest(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    fromDate: string;
    tillDate: string;
    reason?: string;
    requestLocalId?: string;
    days: Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }>;
  }): Promise<any> {
    const { hostId, userId, leaveTypeId, fromDate, tillDate, reason, requestLocalId, days } = payload;

    if (!leaveTypeId || !fromDate || !tillDate || !Array.isArray(days) || days.length === 0) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'leaveTypeId, fromDate, tillDate, and days are required',
        400
      );
    }

    const normalizedRequestLocalId = requestLocalId?.trim();
    const transaction = await sequelize.transaction();

    try {
      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      if (normalizedRequestLocalId) {
        const existing = await leaveRequestAppRepository.getLeaveRequestByLocalId(
          hostId,
          userId,
          normalizedRequestLocalId,
          transaction,
          true
        );

        if (existing) {
          await transaction.commit();
          return this.getLeaveRequestById({
            hostId,
            userId,
            leaveRequestId: Number((existing as any).id),
          });
        }
      }

      const calc = await this.validateRequestByCalculation({
        hostId,
        userId,
        leaveTypeId,
        fromDate,
        tillDate,
        days,
      });

      const overlappingRequests = await leaveRequestAppRepository.findOverlappingLeaveRequests({
        hostId,
        userId,
        fromDate,
        tillDate,
        transaction,
      });

      if (overlappingRequests.length > 0) {
        throw createConfiguredError(
          'OVERLAPPING_LEAVE_REQUEST_EXISTS',
          'Overlapping leave request already exists for the employee',
          409
        );
      }

      const leaveYearId = Number((calc.context.leaveYear as any).id);
      const mappedDays = this.mapLeaveRequestDaysFromInput({
        days,
        dayBreakdown: calc.dayBreakdown,
      });

      if (mappedDays.length === 0) {
        throw createConfiguredError(
          'NO_WORKING_DAYS_IN_RANGE',
          'No applicable leave days found after validation',
          400
        );
      }

      const now = Math.floor(Date.now() / 1000);

      const createdRequest = await leaveRequestAppRepository.createLeaveRequest({
        hostId,
        userId,
        leaveTypeId,
        leaveYearId,
        fromDate,
        tillDate,
        totalDays: calc.totalLeaveDays,
        reason,
        requestLocalId: normalizedRequestLocalId,
        status: 'PENDING',
        submittedAt: now,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestDays({
        hostId,
        userId,
        leaveRequestId: Number((createdRequest as any).id),
        days: mappedDays,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId: Number((createdRequest as any).id),
        approverUserId: userId,
        action: 'SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'PENDING',
        comment: 'Request submitted by employee',
        transaction,
      });

      await leaveBalanceService.applyBalanceChange({
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        transactionType: 'LEAVE_DEBIT',
        quantity: Number(calc.totalLeaveDays),
        reason: `Leave request submitted: ${(createdRequest as any).id}`,
        createdBy: userId,
        deltas: {
          pendingBalanceDelta: Number(calc.totalLeaveDays),
        },
        transaction,
      });

      await transaction.commit();

      return this.getLeaveRequestById({
        hostId,
        userId,
        leaveRequestId: Number((createdRequest as any).id),
      });
    } catch (error: any) {
      await transaction.rollback();

      const message = String(error?.message || '').toLowerCase();
      if (message.includes('uk_leave_request_host_user_local_id')) {
        const existing = normalizedRequestLocalId
          ? await leaveRequestAppRepository.getLeaveRequestByLocalId(hostId, userId, normalizedRequestLocalId)
          : null;
        if (existing) {
          return this.getLeaveRequestById({
            hostId,
            userId,
            leaveRequestId: Number((existing as any).id),
          });
        }
      }

      throw error;
    }
  }

private async resolveLeaveYearForRequest(payload: {
    hostId: number;
    userId: number;
    leaveYearId?: number;
    fromDate?: string;
    tillDate?: string;
  }): Promise<number> {
    const { hostId, userId, leaveYearId, fromDate, tillDate } = payload;

    if (leaveYearId) {
      return Number(leaveYearId);
    }

    const dateForResolution = fromDate || tillDate || new Date().toISOString().slice(0, 10);
    const resolvedYear = await leaveRequestAppRepository.resolveLeaveYearForDate(hostId, dateForResolution);

    if (!resolvedYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'No active leave year found for the requested date',
        400
      );
    }

    const resolvedLeaveYearId = Number((resolvedYear as any).id);
    if (!resolvedLeaveYearId) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Unable to resolve leave year for the requested date',
        400
      );
    }

    return resolvedLeaveYearId;
  }

  async createLeaveRequestV1(payload: {
    hostId: number;
    userId: number;
    leaveYearId?: number;
    fromDate: string;
    tillDate: string;
    reason?: string;
    requestLocalId?: string;
    days: Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' }>;
  }): Promise<any> {
    const { hostId, userId, leaveYearId, fromDate, tillDate, reason, requestLocalId, days } = payload;

    if (!fromDate || !tillDate || !Array.isArray(days) || days.length === 0) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'fromDate, tillDate, and days are required',
        400
      );
    }

    const resolvedLeaveYearId = await this.resolveLeaveYearForRequest({
      hostId,
      userId,
      leaveYearId,
      fromDate,
      tillDate,
    });

    const normalizedRequestLocalId = requestLocalId?.trim();
    const transaction = await sequelize.transaction();

    try {
      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      if (normalizedRequestLocalId) {
        const existing = await leaveRequestAppRepository.getLeaveRequestByLocalId(
          hostId,
          userId,
          normalizedRequestLocalId,
          transaction,
          true
        );

        if (existing) {
          await transaction.commit();
          return this.getLeaveRequestById({
            hostId,
            userId,
            leaveRequestId: Number((existing as any).id),
          });
        }
      }

      const overlappingRequests = await leaveRequestAppRepository.findOverlappingLeaveRequests({
        hostId,
        userId,
        fromDate,
        tillDate,
        transaction,
      });

      if (overlappingRequests.length > 0) {
        throw createConfiguredError(
          'OVERLAPPING_LEAVE_REQUEST_EXISTS',
          'Overlapping leave request already exists for the employee',
          409
        );
      }


      const now = Math.floor(Date.now() / 1000);

      const createdRequest = await leaveRequestAppRepository.createLeaveRequestV1({
        hostId,
        userId,
        leaveYearId: resolvedLeaveYearId,
        fromDate,
        tillDate,
        totalDays: days.length,
        reason,
        requestLocalId: normalizedRequestLocalId,
        status: 'PENDING',
        submittedAt: now,
        transaction,
      });

      const mappedDays = payload.days.map((day) => ({
        leaveDate: day.leaveDate,
        durationType: day.durationType,
        durationDays: day.durationType === 'FULL_DAY' ? 1 : 0.5,
      }));

      await leaveRequestAppRepository.createLeaveRequestDays({
        hostId,
        userId,
        leaveRequestId: Number((createdRequest as any).id),
        days: mappedDays,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId: Number((createdRequest as any).id),
        approverUserId: userId,
        action: 'SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'PENDING',
        comment: 'Request submitted by employee',
        transaction,
      });


      await transaction.commit();

      return this.getLeaveRequestById({
        hostId,
        userId,
        leaveRequestId: Number((createdRequest as any).id),
      });
    } catch (error: any) {
      await transaction.rollback();

      const message = String(error?.message || '').toLowerCase();
      if (message.includes('uk_leave_request_host_user_local_id')) {
        const existing = normalizedRequestLocalId
          ? await leaveRequestAppRepository.getLeaveRequestByLocalId(hostId, userId, normalizedRequestLocalId)
          : null;
        if (existing) {
          return this.getLeaveRequestById({
            hostId,
            userId,
            leaveRequestId: Number((existing as any).id),
          });
        }
      }

      throw error;
    }
  }

  async submitLeaveRequest(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, userId, leaveRequestId } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestAppRepository.getLeaveRequestByIdForUpdate(
        hostId,
        userId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      const status = String((request as any).status);

      if (status === 'PENDING') {
        await transaction.commit();
        return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
      }

      if (status !== 'DRAFT') {
        throw createConfiguredError(
          'INVALID_REQUEST_STATUS_TRANSITION',
          `Cannot submit leave request in ${status} status`,
          400
        );
      }

      const days = await leaveRequestAppRepository.getLeaveRequestDays(
        hostId,
        userId,
        leaveRequestId,
        transaction
      );

      const calc = await this.validateRequestByCalculation({
        hostId,
        userId,
        leaveTypeId: Number((request as any).leaveTypeId),
        fromDate: String((request as any).fromDate),
        tillDate: String((request as any).tillDate),
        days: days.map((d: any) => ({ leaveDate: d.leaveDate, durationType: d.durationType })),
        excludeLeaveRequestId: leaveRequestId,
      });

      const overlappingRequests = await leaveRequestAppRepository.findOverlappingLeaveRequests({
        hostId,
        userId,
        fromDate: String((request as any).fromDate),
        tillDate: String((request as any).tillDate),
        excludeLeaveRequestId: leaveRequestId,
        transaction,
      });

      if (overlappingRequests.length > 0) {
        throw createConfiguredError(
          'OVERLAPPING_LEAVE_REQUEST_EXISTS',
          'Overlapping leave request already exists for the employee',
          409
        );
      }

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestAppRepository.updateLeaveRequestStatus({
        hostId,
        userId,
        leaveRequestId,
        status: 'PENDING',
        submittedAt: now,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId,
        approverUserId: userId,
        action: 'SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'PENDING',
        comment: 'Request submitted by employee',
        transaction,
      });

      await leaveBalanceService.applyBalanceChange({
        hostId,
        userId,
        leaveYearId: Number((request as any).leaveYearId),
        leaveTypeId: Number((request as any).leaveTypeId),
        transactionType: 'LEAVE_DEBIT',
        quantity: Number(calc.totalLeaveDays),
        reason: `Leave request submitted: ${leaveRequestId}`,
        createdBy: userId,
        deltas: {
          pendingBalanceDelta: Number(calc.totalLeaveDays),
        },
        transaction,
      });

      await transaction.commit();

      return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelLeaveRequest(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, userId, leaveRequestId } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestAppRepository.getLeaveRequestByIdForUpdate(
        hostId,
        userId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      const currentStatus = String((request as any).status);

      if (currentStatus === 'CANCELLED') {
        await transaction.commit();
        return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
      }

      if (!['DRAFT', 'PENDING'].includes(currentStatus)) {
        throw createConfiguredError(
          'INVALID_REQUEST_STATUS_TRANSITION',
          `Cannot cancel leave request in ${currentStatus} status`,
          400
        );
      }

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestAppRepository.updateLeaveRequestStatus({
        hostId,
        userId,
        leaveRequestId,
        status: 'CANCELLED',
        cancelledAt: now,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId,
        approverUserId: userId,
        action: 'CANCELLED',
        previousStatus: currentStatus as any,
        newStatus: 'CANCELLED',
        comment: 'Request cancelled by employee',
        transaction,
      });

      if (currentStatus === 'PENDING') {
        await leaveBalanceService.applyBalanceChange({
          hostId,
          userId,
          leaveYearId: Number((request as any).leaveYearId),
          leaveTypeId: Number((request as any).leaveTypeId),
          transactionType: 'LEAVE_REVERSAL',
          quantity: Number((request as any).totalDays) * -1,
          reason: `Leave request cancelled: ${leaveRequestId}`,
          createdBy: userId,
          deltas: {
            pendingBalanceDelta: Number((request as any).totalDays) * -1,
          },
          transaction,
        });
      }

      await transaction.commit();

      return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelLeaveRequestV1(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, userId, leaveRequestId } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestAppRepository.getLeaveRequestByIdForUpdate(
        hostId,
        userId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      const currentStatus = String((request as any).status);

      if (currentStatus === 'CANCELLED') {
        await transaction.commit();
        return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
      }

      if (!['DRAFT', 'PENDING'].includes(currentStatus)) {
        throw createConfiguredError(
          'INVALID_REQUEST_STATUS_TRANSITION',
          `Cannot cancel leave request in ${currentStatus} status`,
          400
        );
      }

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestAppRepository.updateLeaveRequestStatus({
        hostId,
        userId,
        leaveRequestId,
        status: 'CANCELLED',
        cancelledAt: now,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId,
        approverUserId: userId,
        action: 'CANCELLED',
        previousStatus: currentStatus as any,
        newStatus: 'CANCELLED',
        comment: 'Request cancelled by employee',
        transaction,
      });

      // if (currentStatus === 'PENDING') {
      //   await leaveBalanceService.applyBalanceChange({
      //     hostId,
      //     userId,
      //     leaveYearId: Number((request as any).leaveYearId),
      //     leaveTypeId: Number((request as any).leaveTypeId),
      //     transactionType: 'LEAVE_REVERSAL',
      //     quantity: Number((request as any).totalDays) * -1,
      //     reason: `Leave request cancelled: ${leaveRequestId}`,
      //     createdBy: userId,
      //     deltas: {
      //       pendingBalanceDelta: Number((request as any).totalDays) * -1,
      //     },
      //     transaction,
      //   });
      // }

      await transaction.commit();

      return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async withdrawLeaveRequest(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, userId, leaveRequestId } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestAppRepository.getLeaveRequestByIdForUpdate(
        hostId,
        userId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const lockedUser = await leaveRequestAppRepository.lockUserForLeaveOps(hostId, userId, transaction);
      if (!lockedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      const currentStatus = String((request as any).status);

      if (currentStatus === 'WITHDRAWN') {
        await transaction.commit();
        return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
      }

      if (currentStatus !== 'PENDING') {
        throw createConfiguredError(
          'INVALID_REQUEST_STATUS_TRANSITION',
          `Cannot withdraw leave request in ${currentStatus} status`,
          400
        );
      }

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestAppRepository.updateLeaveRequestStatus({
        hostId,
        userId,
        leaveRequestId,
        status: 'WITHDRAWN',
        withdrawnAt: now,
        transaction,
      });

      await leaveRequestAppRepository.createLeaveRequestApproval({
        hostId,
        leaveRequestId,
        approverUserId: userId,
        action: 'WITHDRAWN',
        previousStatus: 'PENDING',
        newStatus: 'WITHDRAWN',
        comment: 'Request withdrawn by employee',
        transaction,
      });

      await leaveBalanceService.applyBalanceChange({
        hostId,
        userId,
        leaveYearId: Number((request as any).leaveYearId),
        leaveTypeId: Number((request as any).leaveTypeId),
        transactionType: 'LEAVE_REVERSAL',
        quantity: Number((request as any).totalDays) * -1,
        reason: `Leave request withdrawn: ${leaveRequestId}`,
        createdBy: userId,
        deltas: {
          pendingBalanceDelta: Number((request as any).totalDays) * -1,
        },
        transaction,
      });

      await transaction.commit();

      return this.getLeaveRequestById({ hostId, userId, leaveRequestId });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new LeaveAppService();
