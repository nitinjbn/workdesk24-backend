import { FindAndCountOptions, Includeable } from 'sequelize';
import { Attendance } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';

type AttendanceInstance = typeof Attendance.prototype;
const ATTENDANCE_COLUMNS = Object.keys(((Attendance as any).getAttributes?.() || (Attendance as any).rawAttributes || {}) as Record<string, unknown>);

export interface AttendanceReportQuery {
  hostId: number;
  page: number;
  limit: number;
  filter: AttendanceReportFilter;
  userId?: number;
  enforceActiveUsersOnly: boolean;
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export class AttendanceReportRepository {
  async getReport(params: AttendanceReportQuery): Promise<ReportResponse<AttendanceInstance>> {
    const { page, limit, filter, hostId, userId, enforceActiveUsersOnly, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const where = this.buildWhere(filter, userId);
    const userFilter = extractUserFilter(filter as Record<string, unknown>);
    const userInclude = buildUserInclude(hostId, userId, enforceActiveUsersOnly, userFilter);
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt',
      batteryPercentage: 'attendanceBatteryPercentage',
      speed: 'attendanceLocationSpeed',
    });

    const query: FindAndCountOptions<AttendanceInstance> = {
      attributes: {
        exclude: ['localId', 'isDeleted', 'deletedAt'],
      },
      where,
      include: [userInclude as Includeable],
      limit,
      offset,
      order,
      distinct: true,
    };

    const { rows, count } = await Attendance.findAndCountAll(query);

    return {
      data: rows,
      pagination: baseReportHelper.buildPagination(count, page, limit),
    };
  }

  private buildWhere(filter: AttendanceReportFilter, userId?: number): Record<string, unknown> {
    const baseWhere = buildUserScopedWhere<AttendanceInstance>(filter, userId) as Record<string, unknown>;
    const dynamicWhere = buildDynamicModelFilters(filter, ATTENDANCE_COLUMNS, ['userId', 'User', 'user']);

    return {
      ...baseWhere,
      ...dynamicWhere,
    };
  }
}

export default new AttendanceReportRepository();
