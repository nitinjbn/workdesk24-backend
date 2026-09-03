import holidayCalendarRepository from '../repositories/holiday-calendar.repository';
import leaveYearRepository from '../repositories/leave-year.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { sequelize } from '../../../models';

export class HolidayCalendarService {
  async getHolidayCalendars(payload: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = payload;

    const report = await holidayCalendarRepository.getHolidayCalendars({
      hostId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      holidayCalendars: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getHolidayCalendarById(payload: {
    hostId: number;
    holidayCalendarId: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId } = payload;

    const holidayCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!holidayCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      holidayCalendar && typeof holidayCalendar.toJSON === 'function'
        ? holidayCalendar.toJSON()
        : holidayCalendar;

    return {
      holidayCalendar: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async createHolidayCalendar(payload: {
    hostId: number;
    leaveYearId: number;
    name: string;
    description?: string;
    isDefault?: number;
  }): Promise<any> {
    const { hostId, leaveYearId, name, description, isDefault } = payload;

    // Validation
    if (!name) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Calendar name is required',
        400
      );
    }

    // Trim and validate name
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw createConfiguredError(
        'INVALID_CALENDAR_NAME',
        'Calendar name must be 1-100 characters',
        400
      );
    }

    // Validate leave year exists and belongs to this host
    if(leaveYearId) {
      const leaveYear = await leaveYearRepository.getLeaveYearById(hostId, leaveYearId);
      if (!leaveYear) {
        throw createConfiguredError(
          'INVALID_LEAVE_YEAR',
          'Leave year not found or does not belong to this organization',
          400
        );
      }
    }

    // Check for duplicate calendar name within same host + leave year
    const isDuplicate = await holidayCalendarRepository.checkCalendarNameExists(
      hostId,
      trimmedName
    );

    if (isDuplicate) {
      throw createConfiguredError(
        'DUPLICATE_CALENDAR_NAME',
        'A calendar with this name already exists',
        400
      );
    }

    // If setting as default, check if another default exists
    if (isDefault === 1) {
      const existingDefault = await holidayCalendarRepository.checkDefaultCalendarExists(
        hostId
      );

      if (existingDefault) {
        throw createConfiguredError(
          'DEFAULT_CALENDAR_EXISTS',
          'A default calendar already exists. Unset the existing default first.',
          400
        );
      }
    }

    // Create holiday calendar
    const holidayCalendar = await holidayCalendarRepository.createHolidayCalendar(
      hostId,
      {
        leaveYearId,
        name: trimmedName,
        description: description?.trim(),
        isDefault: isDefault || 0,
        isEnabled: 1,
      }
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      holidayCalendar && typeof holidayCalendar.toJSON === 'function'
        ? holidayCalendar.toJSON()
        : holidayCalendar;

    return {
      holidayCalendar: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async updateHolidayCalendar(payload: {
    hostId: number;
    holidayCalendarId: number;
    name?: string;
    description?: string;
    isEnabled?: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId, name, description, isEnabled } = payload;

    // Check if calendar exists
    const existingCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!existingCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        throw createConfiguredError(
          'INVALID_CALENDAR_NAME',
          'Calendar name must be 1-100 characters',
          400
        );
      }

      // Check for duplicate name (excluding current calendar)
      const isDuplicate = await holidayCalendarRepository.checkCalendarNameExists(
        hostId,
        trimmedName,
        holidayCalendarId
      );

      if (isDuplicate) {
        throw createConfiguredError(
          'DUPLICATE_CALENDAR_NAME',
          'A calendar with this name already exists for the selected leave year',
          400
        );
      }

      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isEnabled !== undefined) {
      if (isEnabled !== 0 && isEnabled !== 1) {
        throw createConfiguredError(
          'INVALID_INPUT',
          'isEnabled must be 0 or 1',
          400
        );
      }
      updateData.isEnabled = isEnabled;
    }

    // Update calendar
    const updatedCalendar = await holidayCalendarRepository.updateHolidayCalendar(
      hostId,
      holidayCalendarId,
      updateData
    );

    if (!updatedCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedCalendar && typeof updatedCalendar.toJSON === 'function'
        ? updatedCalendar.toJSON()
        : updatedCalendar;

    return {
      holidayCalendar: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async enableDisableHolidayCalendar(payload: {
    hostId: number;
    holidayCalendarId: number;
    isEnabled: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId, isEnabled } = payload;

    // Validation
    if (isEnabled !== 0 && isEnabled !== 1) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'isEnabled must be 0 or 1',
        400
      );
    }

    // Check if calendar exists
    const existingCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!existingCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    // Enable/disable calendar
    const updatedCalendar = await holidayCalendarRepository.enableDisableHolidayCalendar(
      hostId,
      holidayCalendarId,
      isEnabled
    );

    if (!updatedCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedCalendar && typeof updatedCalendar.toJSON === 'function'
        ? updatedCalendar.toJSON()
        : updatedCalendar;

    return {
      holidayCalendar: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async setHolidayCalendarAsDefault(payload: {
    hostId: number;
    holidayCalendarId: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId } = payload;

    // Check if calendar exists
    const holidayCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!holidayCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    // Use transaction to atomically update default status
    const transaction = await sequelize.transaction();

    try {
      const updatedCalendar = await holidayCalendarRepository.setHolidayCalendarAsDefault(
        hostId,
        holidayCalendarId,
        transaction
      );

      await transaction.commit();

      if (!updatedCalendar) {
        throw createConfiguredError(
          'HOLIDAY_CALENDAR_NOT_FOUND',
          'Holiday calendar not found',
          404
        );
      }

      const dateTimeSettings = await getHostDateTimeSettings(hostId);
      const plainData =
        updatedCalendar && typeof updatedCalendar.toJSON === 'function'
          ? updatedCalendar.toJSON()
          : updatedCalendar;

      return {
        holidayCalendar: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteHolidayCalendar(payload: {
    hostId: number;
    holidayCalendarId: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId } = payload;

    // Check if calendar exists
    const existingCalendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!existingCalendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    // Delete calendar (soft delete)
    const deleted = await holidayCalendarRepository.deleteHolidayCalendar(
      hostId,
      holidayCalendarId
    );

    if (!deleted) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    return { success: true };
  }
}

export default new HolidayCalendarService();
