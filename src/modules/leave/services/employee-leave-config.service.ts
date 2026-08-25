import { sequelize } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import holidayCalendarRepository from '../repositories/holiday-calendar.repository';
import leavePolicyRepository from '../repositories/leave-policy.repository';
import employeeLeaveConfigRepository from '../repositories/employee-leave-config.repository';

export class EmployeeLeaveConfigService {
  private async validateHolidayCalendarForHost(hostId: number, holidayCalendarId: number): Promise<void> {
    const holidayCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!holidayCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found for this organization',
        404
      );
    }

    if ((holidayCalendar as any).isEnabled !== 1) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_DISABLED',
        'Holiday calendar is disabled and cannot be assigned',
        400
      );
    }
  }

  private async validateLeavePolicyForHost(hostId: number, leavePolicyId: number): Promise<void> {
    const leavePolicy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);

    if (!leavePolicy) {
      throw createConfiguredError(
        'LEAVE_POLICY_NOT_FOUND',
        'Leave policy not found for this organization',
        404
      );
    }

    if ((leavePolicy as any).isEnabled !== 1) {
      throw createConfiguredError(
        'LEAVE_POLICY_DISABLED',
        'Leave policy is disabled and cannot be assigned',
        400
      );
    }
  }

  async getEmployeeLeaveConfiguration(payload: { hostId: number; userId: number }): Promise<any> {
    const { hostId, userId } = payload;

    const user = await employeeLeaveConfigRepository.getEmployeeById(hostId, userId);

    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const userPlain = user && typeof user.toJSON === 'function' ? user.toJSON() : user;

    return {
      user: formatDateTimeFieldsBySettings(userPlain, dateTimeSettings),
      configuration: {
        holidayCalendarId: (userPlain as any).holidayCalendarId ?? null,
        leavePolicyId: (userPlain as any).leavePolicyId ?? null,
      },
    };
  }

  async updateEmployeeLeaveConfiguration(payload: {
    hostId: number;
    userId: number;
    holidayCalendarId?: number | null;
    leavePolicyId?: number | null;
  }): Promise<any> {
    const { hostId, userId, holidayCalendarId, leavePolicyId } = payload;

    if (holidayCalendarId === undefined && leavePolicyId === undefined) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'At least one of holidayCalendarId or leavePolicyId is required',
        400
      );
    }

    if (holidayCalendarId !== undefined && holidayCalendarId !== null) {
      await this.validateHolidayCalendarForHost(hostId, holidayCalendarId);
    }

    if (leavePolicyId !== undefined && leavePolicyId !== null) {
      await this.validateLeavePolicyForHost(hostId, leavePolicyId);
    }

    const transaction = await sequelize.transaction();

    try {
      const updatedUser = await employeeLeaveConfigRepository.updateEmployeeLeaveConfiguration(
        hostId,
        userId,
        {
          holidayCalendarId,
          leavePolicyId,
        },
        transaction
      );

      if (!updatedUser) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
      }

      await transaction.commit();

      const dateTimeSettings = await getHostDateTimeSettings(hostId);
      const userPlain =
        updatedUser && typeof updatedUser.toJSON === 'function'
          ? updatedUser.toJSON()
          : updatedUser;

      return {
        user: formatDateTimeFieldsBySettings(userPlain, dateTimeSettings),
        configuration: {
          holidayCalendarId: (userPlain as any).holidayCalendarId ?? null,
          leavePolicyId: (userPlain as any).leavePolicyId ?? null,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async bulkUpdateEmployeeLeaveConfiguration(payload: {
    hostId: number;
    employees: Array<{
      userId: number;
      holidayCalendarId?: number | null;
      leavePolicyId?: number | null;
    }>;
  }): Promise<any> {
    const { hostId, employees } = payload;

    if (!Array.isArray(employees) || employees.length === 0) {
      throw createConfiguredError('INVALID_INPUT', 'employees array is required', 400);
    }

    if (employees.length > 500) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Maximum 500 employees can be updated in one request',
        400
      );
    }

    const userIds = employees.map((item) => item.userId);
    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length !== userIds.length) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Duplicate userId values are not allowed in bulk update payload',
        400
      );
    }

    const existingUsers = await employeeLeaveConfigRepository.getEmployeesByIds(hostId, uniqueUserIds);
    if (existingUsers.length !== uniqueUserIds.length) {
      throw createConfiguredError(
        'USER_NOT_FOUND',
        'One or more users were not found for this organization',
        404
      );
    }

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i];

      if (!row.userId) {
        throw createConfiguredError('INVALID_INPUT', `Row ${i + 1}: userId is required`, 400);
      }

      if (row.holidayCalendarId === undefined && row.leavePolicyId === undefined) {
        throw createConfiguredError(
          'INVALID_INPUT',
          `Row ${i + 1}: at least one of holidayCalendarId or leavePolicyId is required`,
          400
        );
      }

      if (row.holidayCalendarId !== undefined && row.holidayCalendarId !== null) {
        await this.validateHolidayCalendarForHost(hostId, row.holidayCalendarId);
      }

      if (row.leavePolicyId !== undefined && row.leavePolicyId !== null) {
        await this.validateLeavePolicyForHost(hostId, row.leavePolicyId);
      }
    }

    const transaction = await sequelize.transaction();

    try {
      const updatedUsers: any[] = [];

      for (const row of employees) {
        const updated = await employeeLeaveConfigRepository.updateEmployeeLeaveConfiguration(
          hostId,
          row.userId,
          {
            holidayCalendarId: row.holidayCalendarId,
            leavePolicyId: row.leavePolicyId,
          },
          transaction
        );

        if (!updated) {
          throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
        }

        const userPlain = updated && typeof updated.toJSON === 'function' ? updated.toJSON() : updated;
        updatedUsers.push(userPlain);
      }

      await transaction.commit();

      const dateTimeSettings = await getHostDateTimeSettings(hostId);

      return {
        users: formatDateTimeFieldsBySettings(updatedUsers, dateTimeSettings),
        count: updatedUsers.length,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new EmployeeLeaveConfigService();
