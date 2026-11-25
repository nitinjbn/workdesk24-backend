import gpsHistoryReportRepository from '../repositories/gps-history-report.repository';
import attendanceReportRepository from '../repositories/attendance-report.repository';
import {
  AdminGpsHistoryJourneyPayload,
  AdminGpsHistoryJourneyResponse,
  AdminGpsHistoryPayload,
  AdminGpsHistoryResponse,
  AttendanceReportResponse,
  AttendanceReportFilter,
  AttendanceReportPayload,
  CommonReportSortBy,
  CommonReportSorting,
  GpsHistoryReportResponse,
  GpsHistoryReportFilter,
  GpsHistoryReportPayload,
  ReportResponse,
  ReportScope,
  UserScopedReportFilter,
  UserScopedReportPayload,
  GetVisitsReportPayload,
  GetOrdersReportPayload,
  GetPaymentsReportPayload,
  GetFeedbacksReportPayload,
  GetImagesReportPayload,
  ActivityTrendFilter,
  ActivityTrendPoint,
  ActivityTrendReportPayload,
  ActivityTrendSummaryRow,
  MonthlyAttendanceReportPayload,
  MonthlyAttendanceMonthFilter,
  MonthlyAttendanceEmployee,
  MonthlyAttendanceReportResponse,
} from '../types/report.types';
import { GpsHistory, Attendance, User } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';
import visitsReportRepository from '../repositories/visits-report.repository';
import ordersReportRepository from '../repositories/orders-report.repository';
import paymentsReportRepository from '../repositories/payments-report.repository';
import feedbacksReportRepository from '../repositories/feedbacks-report.repository';
import imagesReportRepository from '../repositories/images-report.repository';
import activityLogsReportRepository from '../repositories/activity-logs-report.repository';
import { resolveActivityEnrichment } from '../helpers/activity-log.helper';
import moment from 'moment-timezone';
import activityTrendReportRepository from '../repositories/activity-trend-report.repository';

type GpsHistoryInstance = typeof GpsHistory.prototype;
type AttendanceInstance = typeof Attendance.prototype;
type UserInstance = typeof User.prototype;

export class ReportService {
  async getAdminGpsHistoryJourneyReport(
    payload: AdminGpsHistoryJourneyPayload,
    scope: ReportScope
  ): Promise<AdminGpsHistoryJourneyResponse> {
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const scopedUserId = baseReportHelper.parseNumber(scope.requestUserId);
    const payloadUserId = baseReportHelper.parseNumber(payload.filter?.userId);
    const userId = scopedUserId ?? payloadUserId;

    if (userId === null || userId === undefined) {
      throw createConfiguredError(
        'REPORT_USER_SCOPE_REQUIRED',
        'filter.userId is required for journey route',
        400,
        'VALIDATION_ERROR'
      );
    }

    const startTime = baseReportHelper.parseNumber(
      payload.filter?.createdAt?.from ?? payload.filter?.createdAt?.from
    );
    const endTime = baseReportHelper.parseNumber(
      payload.filter?.createdAt?.to ?? payload.filter?.createdAt?.to
    );

    if (startTime === null || endTime === null) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.startEvent.timestamp and filter.endEvent.timestamp are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (startTime > endTime) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.startEvent.timestamp must be less than or equal to filter.endEvent.timestamp',
        400,
        'VALIDATION_ERROR'
      );
    }

    const report = await gpsHistoryReportRepository.getAdminGpsHistoryJourneyReport({
      hostId,
      userId,
      startTime,
      endTime,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    return formatDateTimeFieldsBySettings(report, dateTimeSettings);
  }

  async getAdminGpsHistoryReport(
    payload: AdminGpsHistoryPayload,
    scope: ReportScope
  ): Promise<AdminGpsHistoryResponse> {
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const scopedUserId = baseReportHelper.parseNumber(scope.requestUserId);
    const payloadUserId = baseReportHelper.parseNumber(payload.filter?.userId);
    const userId = scopedUserId ?? payloadUserId;

    if (userId === null || userId === undefined) {
      throw createConfiguredError(
        'REPORT_USER_SCOPE_REQUIRED',
        'filter.userId is required for GPS history',
        400,
        'VALIDATION_ERROR'
      );
    }

    const fromDate = baseReportHelper.parseNumber(payload.filter?.reportTime.from);
    const tillDate = baseReportHelper.parseNumber(payload.filter?.reportTime.to);

    if (fromDate === null || tillDate === null) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.reportTime.from and filter.reportTime.to are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (fromDate > tillDate) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.reportTime.from must be less than or equal to filter.reportTime.to',
        400,
        'VALIDATION_ERROR'
      );
    }

    const report = await gpsHistoryReportRepository.getAdminGpsHistoryReport({
      hostId,
      userId,
      fromDate,
      tillDate,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    return formatDateTimeFieldsBySettings(report, dateTimeSettings);
  }

  async getGpsHistoryReport(
    payload: GpsHistoryReportPayload,
    scope: ReportScope
  ): Promise<GpsHistoryReportResponse<GpsHistoryInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const filter = this.normalizeGpsHistoryFilter(payload);
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const userId = this.resolveEffectiveUserId(filter, scope);
    const enforceActiveUsersOnly = userId === undefined;
    const sorting = this.normalizeCommonSorting(payload);
    //const { page, limit } = payload; // Commented because pagination is mandatory for this report and if not provided, it will default to page 1 and limit 10 in the repository.

    const report = await gpsHistoryReportRepository.getReport({
      hostId,
      page,
      limit,
      filter,
      userId,
      enforceActiveUsersOnly,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      gpsHistory: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getAttendanceReport(
    payload: AttendanceReportPayload,
    scope: ReportScope
  ): Promise<AttendanceReportResponse<AttendanceInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const filter = this.normalizeAttendanceFilter(payload);
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const userId = this.resolveEffectiveUserId(filter, scope);
    const enforceActiveUsersOnly = userId === undefined;
    const sorting = this.normalizeCommonSorting(payload);
    //const { page, limit } = payload; // Commented because pagination is mandatory for this report and if not provided, it will default to page 1 and limit 10 in the repository.

    const report = await attendanceReportRepository.getReport({
      hostId,
      page,
      limit,
      filter,
      userId,
      enforceActiveUsersOnly,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
      download: payload.download,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      attendance: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  private normalizeGpsHistoryFilter(payload: GpsHistoryReportPayload): GpsHistoryReportFilter {
    return this.normalizeUserScopedFilter(payload);
  }

  private normalizeAttendanceFilter(payload: AttendanceReportPayload): AttendanceReportFilter {
    return this.normalizeUserScopedFilter(payload);
  }

  private normalizeUserScopedFilter(payload: UserScopedReportPayload): UserScopedReportFilter {
    return {
      ...(payload.filter || {}),
      userId: payload.filter?.userId ?? payload.userId,
      createdAt: payload.filter?.createdAt ?? payload.createdAt,
    };
  }

  private resolveEffectiveUserId(
    filter: UserScopedReportFilter,
    scope: ReportScope
  ): number | undefined {
    const scopedUserId = baseReportHelper.parseNumber(scope.requestUserId);
    if (scopedUserId !== null) {
      return scopedUserId;
    }

    const nestedUser = (filter.User ?? filter.user) as Record<string, unknown> | undefined;
    const nestedUserId = baseReportHelper.parseNumber(
      nestedUser?.id as number | string | undefined
    );
    if (nestedUserId !== null) {
      return nestedUserId;
    }

    const payloadUserId = baseReportHelper.parseNumber(filter.userId);
    return payloadUserId ?? undefined;
  }

  private resolveRequiredHostId(payloadHostId?: number | string, scopeHostId?: number): number {
    const normalizedHostId = baseReportHelper.parseNumber(scopeHostId ?? payloadHostId);
    if (normalizedHostId === null) {
      throw createConfiguredError('REPORT_HOST_SCOPE_REQUIRED', 'REPORT_HOST_SCOPE_REQUIRED');
    }

    return normalizedHostId;
  }

  private normalizeCommonSorting(payload: UserScopedReportPayload): CommonReportSorting {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    const allowedSortBy: CommonReportSortBy[] = [
      'createdAt',
      'batteryPercentage',
      'speed',
      'userName',
    ];

    const sortBy = allowedSortBy.includes(requestedSortBy as any)
      ? (requestedSortBy as CommonReportSortBy)
      : 'createdAt';

    return {
      sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(requestedSortOrder),
    };
  }

  async getVisitsReport(
    payload: GetVisitsReportPayload
  ): Promise<{ visits: any[]; pagination: any }> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const { hostId, filter, download } = payload;

    const report = await visitsReportRepository.getVisitsReport({
      hostId,
      page,
      limit,
      filter,
      download,
      sortBy: payload.sort?.by || payload.sortBy || 'createdAt',
      sortOrder: baseReportHelper.normalizeSortDirection(payload.sort?.order || payload.sortOrder),
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      visits: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getOrdersReport(
    payload: GetOrdersReportPayload
  ): Promise<{ orders: any[]; pagination: any }> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const { hostId, filter, download } = payload;

    const report = await ordersReportRepository.getOrdersReport({
      hostId,
      page,
      limit,
      filter,
      download,
      sortBy: payload.sort?.by || payload.sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(payload.sort?.order || payload.sortOrder),
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      orders: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getPaymentsReport(
    payload: GetPaymentsReportPayload
  ): Promise<{ payments: any[]; pagination: any }> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const { hostId, filter, download } = payload;

    const report = await paymentsReportRepository.getPaymentsReport({
      hostId,
      page,
      limit,
      filter,
      download,
      sortBy: payload.sort?.by || payload.sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(payload.sort?.order || payload.sortOrder),
    });
    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      payments: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getFeedbacksReport(
    payload: GetFeedbacksReportPayload
  ): Promise<{ feedbacks: any[]; pagination: any }> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const { hostId, filter, download } = payload;

    const report = await feedbacksReportRepository.getFeedbacksReport({
      hostId,
      page,
      limit,
      filter,
      download,
      sortBy: payload.sort?.by || payload.sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(payload.sort?.order || payload.sortOrder),
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      feedbacks: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getImagesReport(
    payload: GetImagesReportPayload
  ): Promise<{ images: any[]; pagination: any }> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const { hostId, filter, download } = payload;

    const report = await imagesReportRepository.getImagesReport({
      hostId,
      page,
      limit,
      filter,
      download,
      sortBy: payload.sort?.by || payload.sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(payload.sort?.order || payload.sortOrder),
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      images: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getAllActivitiesReport(payload: {
    hostId: number;
    filter?: Record<string, any>;
    page?: number;
    limit?: number;
    sort?: { by?: string; order?: 'ASC' | 'DESC' };
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ activities: any[]; pagination: any }> {
    const { hostId, filter, page, limit, sort, sortBy, sortOrder } = payload;

    const report = await activityLogsReportRepository.getAllActivitiesReport({
      hostId,
      page,
      limit,
      filter,
      sortBy: sort?.by || sortBy,
      sortOrder: sort?.order || sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const enriched = plainData.map((record: any) => ({
      userId: record.userId,
      employeeName: record.employeeName,
      module: record.module,
      action: record.action,
      entityId: record.entityId,
      activityTime: record.activityTime,
      ...resolveActivityEnrichment(record, dateTimeSettings),
    }));

    return {
      activities: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLastLocationsReport(payload: {
    hostId: number;
    filter?: Record<string, any>;
  }): Promise<{ lastLocations: any[] }> {
    const { hostId, filter } = payload;

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    // Calculate the start and end of the current day in the host's timezone
    const startOfDay = moment()
      .tz(dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE)
      .startOf('day')
      .unix();
    const endOfDay = moment()
      .tz(dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE)
      .endOf('day')
      .unix();

    const report = await gpsHistoryReportRepository.getLastLocationsReport({
      hostId,
      filter: {
        ...filter,
        createdAt: {
          from: startOfDay,
          to: endOfDay,
        },
      },
    });

    const plainData = report.lastLocations.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      lastLocations: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    };
  }

  async getActivityTrendReport(
    payload: ActivityTrendReportPayload
  ): Promise<{ activityTrend: ActivityTrendPoint[] }> {
    const hostId = this.resolveRequiredHostId(payload.hostId);
    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const timeZone = dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE;
    const { fromDateUnix, tillDateUnix } = this.resolveActivityTrendRange(
      payload.filter?.activityTrend,
      timeZone
    );

    const rows = await activityTrendReportRepository.getActivityTrendReport({
      hostId,
      fromDateUnix,
      tillDateUnix,
    });

    return {
      activityTrend: this.buildActivityTrendSeries(rows, fromDateUnix, tillDateUnix, timeZone),
    };
  }

  private resolveActivityTrendRange(
    filter: ActivityTrendFilter | undefined,
    timeZone: string
  ): { fromDateUnix: number; tillDateUnix: number } {
    const tillDate = filter?.tillDate
      ? moment.tz(filter.tillDate, 'YYYY-MM-DD', true, timeZone)
      : moment.tz(timeZone);
    const fromDate = filter?.fromDate
      ? moment.tz(filter.fromDate, 'YYYY-MM-DD', true, timeZone)
      : tillDate.clone().subtract(6, 'days');

    if (!fromDate.isValid() || !tillDate.isValid()) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.activityTrend.fromDate and filter.activityTrend.tillDate must be valid YYYY-MM-DD dates',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (fromDate.isAfter(tillDate, 'day')) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.activityTrend.fromDate must be less than or equal to filter.activityTrend.tillDate',
        400,
        'VALIDATION_ERROR'
      );
    }

    return {
      fromDateUnix: fromDate.clone().startOf('day').unix(),
      tillDateUnix: tillDate.clone().endOf('day').unix(),
    };
  }

  private buildActivityTrendSeries(
    rows: ActivityTrendSummaryRow[],
    fromDateUnix: number,
    tillDateUnix: number,
    timeZone: string
  ): ActivityTrendPoint[] {
    const rowsByDay = new Map<string, ActivityTrendSummaryRow>();
    rows.forEach((row) => {
      const reportDate = Number(row.reportDate);
      if (Number.isFinite(reportDate) && reportDate > 0) {
        rowsByDay.set(moment.unix(reportDate).tz(timeZone).format('YYYY-MM-DD'), row);
      }
    });

    const activityTrend: ActivityTrendPoint[] = [];
    const cursor = moment.unix(fromDateUnix).tz(timeZone).startOf('day');
    const end = moment.unix(tillDateUnix).tz(timeZone).endOf('day');

    while (cursor.isSameOrBefore(end)) {
      const row = rowsByDay.get(cursor.format('YYYY-MM-DD'));
      activityTrend.push({
        day: cursor.format('D MMM'),
        attendance: this.toTrendCount(row?.attendance),
        visits: this.toTrendCount(row?.visits),
        orders: this.toTrendCount(row?.orders),
        payments: this.toTrendCount(row?.payments),
      });
      cursor.add(1, 'day');
    }

    return activityTrend;
  }

  private toTrendCount(value: unknown): number {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  async getMonthlyAttendanceReport(
    payload: MonthlyAttendanceReportPayload
  ): Promise<MonthlyAttendanceReportResponse> {
    const { hostId, filter } = payload;
    const attendanceTime = filter?.attendanceTime;
    if (!attendanceTime) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.attendanceTime.from and filter.attendanceTime.to are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const timeZone = dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE;
    const normalizedRange = this.normalizeMonthlyAttendanceRange(attendanceTime, timeZone);
    const report = await attendanceReportRepository.getMonthlyAttendanceReport(
      {
        ...payload,
        filter: {
          ...filter,
          attendanceTime: normalizedRange,
        },
      },
      timeZone
    );
    const attendanceByUserAndDate = new Map<string, string>();
    report.attendance.forEach((record) => {
      attendanceByUserAndDate.set(
        `${record.userId}:${moment.unix(Number(record.attendanceTime)).tz(timeZone).format('YYYY-MM-DD')}`,
        record.attendanceStatus || ''
      );
    });
    const leaveDates = new Set(report.leaveDates.map((row) => `${row.userId}:${row.leaveDate}`));
    const holidayDates = new Set(
      report.holidays.map((row) => `${row.holidayCalendarId}:${row.holidayDate}`)
    );
    const from = moment.unix(normalizedRange.from).tz(timeZone).startOf('day');
    const till = moment
      .unix(normalizedRange.to - 1)
      .tz(timeZone)
      .startOf('day');
    const today = moment.tz(timeZone).startOf('day');
    const dates: moment.Moment[] = [];
    for (const cursor = from.clone(); cursor.isSameOrBefore(till, 'day'); cursor.add(1, 'day')) {
      dates.push(cursor.clone());
    }

    const employees: MonthlyAttendanceEmployee[] = report.users.map((user) => {
      const settings = user.settings?.find((setting) => setting.settingName === 'weeklyOffMask');
      const weeklyOffMask = Number(settings?.settingValue || 0);
      const attendance: MonthlyAttendanceEmployee['attendance'] = {};
      const summary = {
        present: 0,
        absent: 0,
        leave: 0,
        weekOff: 0,
        holiday: 0,
        workingDays: 0,
        attendancePercentage: 0,
      };

      dates.forEach((date) => {
        const dateKey = date.format('YYYY-MM-DD');
        const recordStatus = attendanceByUserAndDate.get(`${user.id}:${dateKey}`);
        const isPresent = recordStatus?.toLowerCase() === 'present';
        const isLeave = !isPresent && leaveDates.has(`${user.id}:${dateKey}`);
        const isHoliday = holidayDates.has(`${user.holidayCalendarId}:${dateKey}`);
        const isWeekOff = (weeklyOffMask & (1 << date.day())) !== 0;
        const isFuture = date.isAfter(today, 'day');
        const status = isPresent
          ? 'P'
          : isLeave
            ? 'L'
            : isHoliday
              ? 'H'
              : isWeekOff
                ? 'WO'
                : isFuture
                  ? '-'
                  : 'A';
        attendance[String(date.date())] = status;
        if (status !== '-') {
          summary[
            status === 'P'
              ? 'present'
              : status === 'L'
                ? 'leave'
                : status === 'H'
                  ? 'holiday'
                  : status === 'WO'
                    ? 'weekOff'
                    : 'absent'
          ] += 1;
        }
      });

      summary.workingDays =
        dates.filter((date) => !date.isAfter(today, 'day')).length -
        summary.weekOff -
        summary.holiday;
      summary.attendancePercentage =
        summary.workingDays > 0
          ? Number(((summary.present / summary.workingDays) * 100).toFixed(2))
          : 0;
      return {
        userId: user.id,
        employeeCode: user.employeeCode,
        employeeName: user.name,
        attendance,
        summary,
      };
    });

    return { employees, pagination: report.pagination };
  }

  private normalizeMonthlyAttendanceRange(
    range: { from: number | string; to: number | string } | MonthlyAttendanceMonthFilter,
    timeZone: string
  ): { from: number; to: number } {
    if ('month' in range && 'year' in range) {
      const month = Number(range.month);
      const year = Number(range.year);
      const monthStart = moment.tz({ year, month: month - 1, day: 1 }, timeZone);

      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(year) ||
        year < 1970 ||
        !monthStart.isValid() ||
        monthStart.year() !== year ||
        monthStart.month() !== month - 1
      ) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          'filter.attendanceTime.month must be between 1 and 12 and year must be valid',
          400,
          'VALIDATION_ERROR'
        );
      }

      return {
        from: monthStart.startOf('month').unix(),
        to: monthStart.clone().add(1, 'month').startOf('month').unix(),
      };
    }

    const parseDate = (value: number | string, endOfDay = false): moment.Moment => {
      if (typeof value === 'number' || /^\d+$/.test(value)) {
        return moment.unix(Number(value)).tz(timeZone);
      }

      return moment.tz(value, 'YYYY-MM-DD', true, timeZone).startOf(endOfDay ? 'day' : 'day');
    };

    const from = parseDate(range.from);
    const to = parseDate(range.to, true);
    if (!from.isValid() || !to.isValid() || from.isAfter(to, 'day')) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'filter.attendanceTime.from and filter.attendanceTime.to must be valid dates with from less than or equal to to',
        400,
        'VALIDATION_ERROR'
      );
    }

    return {
      from: from.startOf('day').unix(),
      to: to.add(1, 'day').startOf('day').unix(),
    };
  }
}

export default new ReportService();
