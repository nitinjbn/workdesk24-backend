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
  GetImagesReportPayload
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

  private resolveEffectiveUserId(filter: UserScopedReportFilter, scope: ReportScope): number | undefined {
    const scopedUserId = baseReportHelper.parseNumber(scope.requestUserId);
    if (scopedUserId !== null) {
      return scopedUserId;
    }

    const nestedUser = (filter.User ?? filter.user) as Record<string, unknown> | undefined;
    const nestedUserId = baseReportHelper.parseNumber(nestedUser?.id as number | string | undefined);
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
    const { hostId, filter } = payload;

    const report = await visitsReportRepository.getVisitsReport({
      hostId,
      page,
      limit,
      filter,
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
    const { hostId, filter } = payload;

    const report = await ordersReportRepository.getOrdersReport({
      hostId,
      page,
      limit,
      filter,
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
    const { hostId, filter } = payload;

    const report = await paymentsReportRepository.getPaymentsReport({
      hostId,
      page,
      limit,
      filter,
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
    const { hostId, filter } = payload;

    const report = await feedbacksReportRepository.getFeedbacksReport({
      hostId,
      page,
      limit,
      filter,
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
    const { hostId, filter } = payload;

    const report = await imagesReportRepository.getImagesReport({
      hostId,
      page,
      limit,
      filter,
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

  async getAllActivitiesReport(
    payload: { hostId: number; filter?: Record<string, any>; page?: number; limit?: number; sort?: { by?: string; order?: "ASC" | "DESC" }; sortBy?: string; sortOrder?: "ASC" | "DESC" },
  ): Promise<{ activities: any[]; pagination: any }> {
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
}

export default new ReportService();