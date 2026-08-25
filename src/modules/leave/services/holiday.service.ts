import holidayRepository from '../repositories/holiday.repository';
import holidayCalendarRepository from '../repositories/holiday-calendar.repository';
import leaveYearRepository from '../repositories/leave-year.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { sequelize } from '../../../models';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class HolidayService {
  private validateDateFormat(date: string): boolean {
    return DATE_REGEX.test(date);
  }

  private validateDateRange(date: string, startDate: string, endDate: string): boolean {
    return date >= startDate && date <= endDate;
  }

  async getHolidaysByCalendar(payload: {
    hostId: number;
    holidayCalendarId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, holidayCalendarId, filter, page, limit, sortBy, sortOrder } = payload;

    // Validate calendar exists and belongs to host
    const calendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!calendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found',
        404
      );
    }

    const report = await holidayRepository.getHolidaysByCalendar({
      hostId,
      holidayCalendarId,
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
      holidays: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getHolidayById(payload: {
    hostId: number;
    holidayId: number;
  }): Promise<any> {
    const { hostId, holidayId } = payload;

    const holiday = await holidayRepository.getHolidayById(hostId, holidayId);

    if (!holiday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      holiday && typeof holiday.toJSON === 'function'
        ? holiday.toJSON()
        : holiday;

    return {
      holiday: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async createHoliday(payload: {
    hostId: number;
    holidayCalendarId: number;
    holidayDate: string;
    name: string;
    description?: string;
    isOptional?: number;
  }): Promise<any> {
    const { hostId, holidayCalendarId, holidayDate, name, description, isOptional } = payload;

    // Validation
    if (!holidayCalendarId || !holidayDate || !name) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Holiday calendar ID, date, and name are required',
        400
      );
    }

    // Validate date format
    if (!this.validateDateFormat(holidayDate)) {
      throw createConfiguredError(
        'INVALID_DATE_FORMAT',
        'Holiday date must be in YYYY-MM-DD format',
        400
      );
    }

    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw createConfiguredError(
        'INVALID_HOLIDAY_NAME',
        'Holiday name must be 1-100 characters',
        400
      );
    }

    // Validate calendar exists and belongs to host
    const calendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!calendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found or does not belong to this organization',
        404
      );
    }

    // Validate holiday date is within leave year range
    const leaveYear = await leaveYearRepository.getLeaveYearById(
      hostId,
      (calendar as any).leaveYearId
    );

    if (!leaveYear) {
      throw createConfiguredError(
        'INVALID_LEAVE_YEAR',
        'Associated leave year not found',
        400
      );
    }

    if (!this.validateDateRange(
      holidayDate,
      (leaveYear as any).startDate,
      (leaveYear as any).endDate
    )) {
      throw createConfiguredError(
        'HOLIDAY_DATE_OUT_OF_RANGE',
        `Holiday date must be within leave year range (${(leaveYear as any).startDate} to ${(leaveYear as any).endDate})`,
        400
      );
    }

    // Check for duplicate holiday date in calendar
    const isDuplicate = await holidayRepository.checkHolidayDateExists(
      hostId,
      holidayCalendarId,
      holidayDate
    );

    if (isDuplicate) {
      throw createConfiguredError(
        'DUPLICATE_HOLIDAY_DATE',
        'A holiday with this date already exists in the calendar',
        400
      );
    }

    // Create holiday
    const holiday = await holidayRepository.createHoliday(hostId, {
      holidayCalendarId,
      holidayDate,
      name: trimmedName,
      description: description?.trim(),
      isOptional: isOptional || 0,
      isEnabled: 1,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      holiday && typeof holiday.toJSON === 'function'
        ? holiday.toJSON()
        : holiday;

    return {
      holiday: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async updateHoliday(payload: {
    hostId: number;
    holidayId: number;
    holidayDate?: string;
    name?: string;
    description?: string;
    isOptional?: number;
    isEnabled?: number;
  }): Promise<any> {
    const { hostId, holidayId, holidayDate, name, description, isOptional, isEnabled } = payload;

    // Check if holiday exists
    const existingHoliday = await holidayRepository.getHolidayById(hostId, holidayId);

    if (!existingHoliday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (holidayDate !== undefined) {
      if (!this.validateDateFormat(holidayDate)) {
        throw createConfiguredError(
          'INVALID_DATE_FORMAT',
          'Holiday date must be in YYYY-MM-DD format',
          400
        );
      }

      // Validate new date is within leave year range
      const leaveYear = await leaveYearRepository.getLeaveYearById(
        hostId,
        (existingHoliday as any).leaveYearId || 0
      );

      if (leaveYear) {
        if (!this.validateDateRange(
          holidayDate,
          (leaveYear as any).startDate,
          (leaveYear as any).endDate
        )) {
          throw createConfiguredError(
            'HOLIDAY_DATE_OUT_OF_RANGE',
            `Holiday date must be within leave year range (${(leaveYear as any).startDate} to ${(leaveYear as any).endDate})`,
            400
          );
        }
      }

      // Check for duplicate date (excluding current holiday)
      const isDuplicate = await holidayRepository.checkHolidayDateExists(
        hostId,
        (existingHoliday as any).holidayCalendarId,
        holidayDate,
        holidayId
      );

      if (isDuplicate) {
        throw createConfiguredError(
          'DUPLICATE_HOLIDAY_DATE',
          'A holiday with this date already exists in the calendar',
          400
        );
      }

      updateData.holidayDate = holidayDate;
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        throw createConfiguredError(
          'INVALID_HOLIDAY_NAME',
          'Holiday name must be 1-100 characters',
          400
        );
      }
      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isOptional !== undefined) {
      if (isOptional !== 0 && isOptional !== 1) {
        throw createConfiguredError(
          'INVALID_INPUT',
          'isOptional must be 0 or 1',
          400
        );
      }
      updateData.isOptional = isOptional;
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

    // Update holiday
    const updatedHoliday = await holidayRepository.updateHoliday(
      hostId,
      holidayId,
      updateData
    );

    if (!updatedHoliday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedHoliday && typeof updatedHoliday.toJSON === 'function'
        ? updatedHoliday.toJSON()
        : updatedHoliday;

    return {
      holiday: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async enableDisableHoliday(payload: {
    hostId: number;
    holidayId: number;
    isEnabled: number;
  }): Promise<any> {
    const { hostId, holidayId, isEnabled } = payload;

    // Validation
    if (isEnabled !== 0 && isEnabled !== 1) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'isEnabled must be 0 or 1',
        400
      );
    }

    // Check if holiday exists
    const existingHoliday = await holidayRepository.getHolidayById(hostId, holidayId);

    if (!existingHoliday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    // Enable/disable holiday
    const updatedHoliday = await holidayRepository.enableDisableHoliday(
      hostId,
      holidayId,
      isEnabled
    );

    if (!updatedHoliday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedHoliday && typeof updatedHoliday.toJSON === 'function'
        ? updatedHoliday.toJSON()
        : updatedHoliday;

    return {
      holiday: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async deleteHoliday(payload: {
    hostId: number;
    holidayId: number;
  }): Promise<any> {
    const { hostId, holidayId } = payload;

    // Check if holiday exists
    const existingHoliday = await holidayRepository.getHolidayById(hostId, holidayId);

    if (!existingHoliday) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    // Delete holiday (soft delete)
    const deleted = await holidayRepository.deleteHoliday(hostId, holidayId);

    if (!deleted) {
      throw createConfiguredError(
        'HOLIDAY_NOT_FOUND',
        'Holiday not found',
        404
      );
    }

    return { success: true };
  }

  async bulkCreateHolidays(payload: {
    hostId: number;
    holidayCalendarId: number;
    holidays: Array<{
      holidayDate: string;
      name: string;
      description?: string;
      isOptional?: number;
    }>;
  }): Promise<any> {
    const { hostId, holidayCalendarId, holidays } = payload;

    // Validation
    if (!holidayCalendarId || !holidays || !Array.isArray(holidays) || holidays.length === 0) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Holiday calendar ID and holidays array are required',
        400
      );
    }

    if (holidays.length > 365) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Maximum 365 holidays can be imported at once',
        400
      );
    }

    // Validate calendar exists and belongs to host
    const calendar = await holidayCalendarRepository.getHolidayCalendarById(
      hostId,
      holidayCalendarId
    );

    if (!calendar) {
      throw createConfiguredError(
        'HOLIDAY_CALENDAR_NOT_FOUND',
        'Holiday calendar not found or does not belong to this organization',
        404
      );
    }

    // Get leave year for validation
    const leaveYear = await leaveYearRepository.getLeaveYearById(
      hostId,
      (calendar as any).leaveYearId
    );

    if (!leaveYear) {
      throw createConfiguredError(
        'INVALID_LEAVE_YEAR',
        'Associated leave year not found',
        400
      );
    }

    // Validate and prepare all holidays
    const validatedHolidays: Array<{
      holidayCalendarId: number;
      holidayDate: string;
      name: string;
      description?: string;
      isOptional?: number;
      isEnabled?: number;
    }> = [];
    const existingDates = new Set<string>();

    for (let i = 0; i < holidays.length; i++) {
      const h = holidays[i];

      // Validate date format
      if (!this.validateDateFormat(h.holidayDate)) {
        throw createConfiguredError(
          'INVALID_DATE_FORMAT',
          `Row ${i + 1}: Holiday date must be in YYYY-MM-DD format`,
          400
        );
      }

      // Validate date is within leave year range
      if (!this.validateDateRange(
        h.holidayDate,
        (leaveYear as any).startDate,
        (leaveYear as any).endDate
      )) {
        throw createConfiguredError(
          'HOLIDAY_DATE_OUT_OF_RANGE',
          `Row ${i + 1}: Holiday date must be within leave year range`,
          400
        );
      }

      // Validate name
      const trimmedName = h.name?.trim() || '';
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        throw createConfiguredError(
          'INVALID_HOLIDAY_NAME',
          `Row ${i + 1}: Holiday name must be 1-100 characters`,
          400
        );
      }

      // Check for duplicates within the import batch
      if (existingDates.has(h.holidayDate)) {
        throw createConfiguredError(
          'DUPLICATE_HOLIDAY_DATE',
          `Row ${i + 1}: Duplicate holiday date in import batch`,
          400
        );
      }
      existingDates.add(h.holidayDate);

      validatedHolidays.push({
        holidayCalendarId,
        holidayDate: h.holidayDate,
        name: trimmedName,
        description: h.description?.trim(),
        isOptional: h.isOptional || 0,
        isEnabled: 1,
      });
    }

    // Check for existing dates in database
    for (const h of validatedHolidays) {
      const exists = await holidayRepository.checkHolidayDateExists(
        hostId,
        holidayCalendarId,
        h.holidayDate
      );

      if (exists) {
        throw createConfiguredError(
          'DUPLICATE_HOLIDAY_DATE',
          `Holiday with date ${h.holidayDate} already exists in the calendar`,
          400
        );
      }
    }

    // Bulk create with transaction
    const transaction = await sequelize.transaction();

    try {
      const createdHolidays = await holidayRepository.createBulkHolidays(
        hostId,
        validatedHolidays,
        transaction
      );

      await transaction.commit();

      const dateTimeSettings = await getHostDateTimeSettings(hostId);
      const plainData = createdHolidays.map((item: any) =>
        item && typeof item.toJSON === 'function' ? item.toJSON() : item
      );

      return {
        holidays: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
        count: createdHolidays.length,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new HolidayService();
