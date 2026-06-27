import { FindAndCountOptions, Includeable } from 'sequelize';
import { GpsHistory } from '../../../models';
import { CommonReportSortBy, GpsHistoryReportFilter, ReportResponse, ReportSortDirection } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';

type GpsHistoryInstance = typeof GpsHistory.prototype;

export interface GpsHistoryReportQuery {
  hostId: number;
  page: number;
  limit: number;
  filter: GpsHistoryReportFilter;
  userId?: number;
  enforceActiveUsersOnly: boolean;
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export class GpsHistoryReportRepository {
  async getReport(params: GpsHistoryReportQuery): Promise<ReportResponse<GpsHistoryInstance>> {
    const { page, limit, filter, hostId, userId, enforceActiveUsersOnly, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const where = buildUserScopedWhere<GpsHistoryInstance>(filter, userId);
    const userFilter = extractUserFilter(filter as Record<string, unknown>);
    const userInclude = buildUserInclude(hostId, userId, enforceActiveUsersOnly, userFilter);
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt',
      batteryPercentage: 'batteryPercentage',
      speed: 'speed',
    });

    const query: FindAndCountOptions<GpsHistoryInstance> = {
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

    console.log("############## query:", query);

    const result = await GpsHistory.findAndCountAll(query);
    console.log("#################### result:", result);
    const { rows, count } = result;
    //console.log("############################ rows:", rows);
    console.log("############################ count:", count);

    return {
      data: rows,
      pagination: baseReportHelper.buildPagination(count, page, limit),
    };
  }
}

export default new GpsHistoryReportRepository();