import leaveYearRepository from '../repositories/leave-year.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';

export class LeaveYearService {
  async getLeaveYears(payload: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = payload;

    const report = await leaveYearRepository.getLeaveYears({
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
      leaveYears: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLeaveYearById(payload: {
    hostId: number;
    leaveYearId: number;
  }): Promise<any> {
    const { hostId, leaveYearId } = payload;

    const leaveYear = await leaveYearRepository.getLeaveYearById(
      hostId,
      leaveYearId
    );

    if (!leaveYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Leave year not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      leaveYear && typeof leaveYear.toJSON === 'function'
        ? leaveYear.toJSON()
        : leaveYear;

    return {
      leaveYear: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async createLeaveYear(payload: {
    hostId: number;
    year: number;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    const { hostId, year, startDate, endDate } = payload;

    // Validation
    if (!year || !startDate || !endDate) {
      throw createConfiguredError(
        'INVALID_INPUT',
        'Year, start date, and end date are required',
        400
      );
    }

    // Validate year is a valid number
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw createConfiguredError(
        'INVALID_YEAR',
        'Year must be a valid number between 2000 and 2100',
        400
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw createConfiguredError(
        'INVALID_DATE_FORMAT',
        'Start date and end date must be in YYYY-MM-DD format',
        400
      );
    }

    // Validate that startDate is before or equal to endDate
    if (startDate > endDate) {
      throw createConfiguredError(
        'INVALID_DATE_RANGE',
        'Start date must be before or equal to end date',
        400
      );
    }

    // Check if leave year with same year already exists for this host
    const existingLeaveYear = await leaveYearRepository.getLeaveYearByYear(
      hostId,
      year
    );

    if (existingLeaveYear) {
      throw createConfiguredError(
        'DUPLICATE_LEAVE_YEAR',
        `Leave year ${year} already exists for this organization`,
        400
      );
    }

    // Create leave year
    const leaveYear = await leaveYearRepository.createLeaveYear(
      hostId,
      {
        year,
        startDate,
        endDate,
      }
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      leaveYear && typeof leaveYear.toJSON === 'function'
        ? leaveYear.toJSON()
        : leaveYear;

    return {
      leaveYear: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async updateLeaveYear(payload: {
    hostId: number;
    leaveYearId: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const { hostId, leaveYearId, year, startDate, endDate } = payload;

    // Check if leave year exists
    const existingLeaveYear = await leaveYearRepository.getLeaveYearById(
      hostId,
      leaveYearId
    );

    if (!existingLeaveYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Leave year not found',
        404
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (year !== undefined) {
      // Validate year is a valid number
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw createConfiguredError(
          'INVALID_YEAR',
          'Year must be a valid number between 2000 and 2100',
          400
        );
      }

      // Check if another leave year with same year already exists
      const duplicateLeaveYear = await leaveYearRepository.getLeaveYearByYear(
        hostId,
        year,
        leaveYearId
      );

      if (duplicateLeaveYear) {
        throw createConfiguredError(
          'DUPLICATE_LEAVE_YEAR',
          `Leave year ${year} already exists for this organization`,
          400
        );
      }

      updateData.year = year;
    }

    if (startDate !== undefined) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate)) {
        throw createConfiguredError(
          'INVALID_DATE_FORMAT',
          'Start date must be in YYYY-MM-DD format',
          400
        );
      }
      updateData.startDate = startDate;
    }

    if (endDate !== undefined) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(endDate)) {
        throw createConfiguredError(
          'INVALID_DATE_FORMAT',
          'End date must be in YYYY-MM-DD format',
          400
        );
      }
      updateData.endDate = endDate;
    }

    // Validate that startDate is before or equal to endDate
    const finalStartDate = updateData.startDate || existingLeaveYear.startDate;
    const finalEndDate = updateData.endDate || existingLeaveYear.endDate;

    if (finalStartDate > finalEndDate) {
      throw createConfiguredError(
        'INVALID_DATE_RANGE',
        'Start date must be before or equal to end date',
        400
      );
    }

    // Update leave year
    const updatedLeaveYear = await leaveYearRepository.updateLeaveYear(
      hostId,
      leaveYearId,
      updateData
    );

    if (!updatedLeaveYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Leave year not found',
        404
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      updatedLeaveYear && typeof updatedLeaveYear.toJSON === 'function'
        ? updatedLeaveYear.toJSON()
        : updatedLeaveYear;

    return {
      leaveYear: formatDateTimeFieldsBySettings([plainData], dateTimeSettings)[0],
    };
  }

  async deleteLeaveYear(payload: {
    hostId: number;
    leaveYearId: number;
  }): Promise<any> {
    const { hostId, leaveYearId } = payload;

    // Check if leave year exists
    const existingLeaveYear = await leaveYearRepository.getLeaveYearById(
      hostId,
      leaveYearId
    );

    if (!existingLeaveYear) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Leave year not found',
        404
      );
    }

    // Check for dependent records
    const dependents = await leaveYearRepository.checkDependentRecords(
      hostId,
      leaveYearId
    );

    if (dependents.hasDependents) {
      throw createConfiguredError(
        'LEAVE_YEAR_HAS_DEPENDENTS',
        `Cannot delete leave year. ${dependents.dependencyCount} dependent record(s) exist`,
        400
      );
    }

    // Delete leave year (soft delete)
    const deleted = await leaveYearRepository.deleteLeaveYear(
      hostId,
      leaveYearId
    );

    if (!deleted) {
      throw createConfiguredError(
        'LEAVE_YEAR_NOT_FOUND',
        'Leave year not found',
        404
      );
    }

    return { success: true };
  }
}

export default new LeaveYearService();
