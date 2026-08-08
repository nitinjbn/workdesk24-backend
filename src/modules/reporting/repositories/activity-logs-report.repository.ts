import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Image } from '../../../models';
import { CommonReportSortBy, ReportResponse, ReportSortDirection } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class ActivityLogsReportRepository {
  async getAllActivitiesReport(params: { hostId: number; filter?: Record<string, any>; page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });

    let activityWhere: Record<string, any> = { hostId };
    if(filter) {
      if(filter.userId) {
        activityWhere.userId = filter.userId;
      }
      if(filter.customerId) {
        activityWhere.customerId = filter.customerId;
      }
      if(filter.activityTime) {
        activityWhere.activityTime = {
          [Op.gte]: filter.activityTime?.from,
          [Op.lte]: filter.activityTime?.to,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['createdAt', 'isDeleted']
      },
      where: activityWhere,
      order: [sortBy && sortOrder ? [sortBy, sortOrder] : ['activityTime', 'DESC']],
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await db.ActivityLog.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await db.ActivityLog.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new ActivityLogsReportRepository();
