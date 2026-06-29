import gpsHistoryReportRepository from '../repositories/gps-history-report.repository';
import attendanceReportRepository from '../repositories/attendance-report.repository';
import usersRepository from '../repositories/users-report.repository';
import {
  AttendanceReportFilter,
  AttendanceReportPayload,
  CommonReportSortBy,
  CommonReportSorting,
  GpsHistoryReportFilter,
  GpsHistoryReportPayload,
  ReportResponse,
  ReportScope,
  UserScopedReportFilter,
  UserScopedReportPayload,
  GetUsersPayload
} from '../types/report.types';
import { GpsHistory, Attendance, User } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';

type GpsHistoryInstance = typeof GpsHistory.prototype;
type AttendanceInstance = typeof Attendance.prototype;
type UserInstance = typeof User.prototype;

export class ReportService {
  async getGpsHistoryReport(
    payload: GpsHistoryReportPayload,
    scope: ReportScope
  ): Promise<ReportResponse<GpsHistoryInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const filter = this.normalizeGpsHistoryFilter(payload);
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const userId = this.resolveEffectiveUserId(filter, scope);
    const enforceActiveUsersOnly = userId === undefined;
    const sorting = this.normalizeCommonSorting(payload);

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
      ...report,
      data: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    } as ReportResponse<GpsHistoryInstance>;
  }

  async getAttendanceReport(
    payload: AttendanceReportPayload,
    scope: ReportScope
  ): Promise<ReportResponse<AttendanceInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const filter = this.normalizeAttendanceFilter(payload);
    const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    const userId = this.resolveEffectiveUserId(filter, scope);
    const enforceActiveUsersOnly = userId === undefined;
    const sorting = this.normalizeCommonSorting(payload);

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
      ...report,
      data: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    } as ReportResponse<AttendanceInstance>;
  }

  async getAppUsers(
    payload: GetUsersPayload,
    scope: ReportScope
  ): Promise<ReportResponse<UserInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    //const filter = this.normalizeAttendanceFilter(payload);
    //const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    //const userId = this.resolveEffectiveUserId(filter, scope);
    const sorting = this.normalizeCommonSorting(payload as any);
    let { hostId, filter } = payload;
    filter = {
      ...filter,
      roleCode: CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES
    }

    const report = await usersRepository.getUsers({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      ...report,
      data: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    } as ReportResponse<UserInstance>;
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
}

export default new ReportService();