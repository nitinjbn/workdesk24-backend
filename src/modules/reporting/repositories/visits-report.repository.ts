import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Visit } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetVisitsReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class VisitsReportRepository {
  async getVisitsReport(params: GetVisitsReportPayload): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });

    let where: Record<string, any> = { hostId, isDeleted: 0 };
    if(filter) {
      if(filter.userId) {
        where.userId = filter.userId;
      }
      if(filter.customerId) {
        where.customerId = filter.customerId;
      }
      if(filter.customerName?.trim()) {
        where.customerName = { [Op.like]: `%${filter.customerName?.trim()}%` };
      }
      if(filter.checkInTime) {
        where.checkInTime = {
          [Op.gte]: filter.checkInTime?.from,
          [Op.lte]: filter.checkInTime?.to,
        };
      }
      if(filter.checkOutTime) {
        where.checkOutTime = {
          [Op.gte]: filter.checkOutTime?.from,
          [Op.lte]: filter.checkOutTime?.to,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'checkInLocationAccuracy', 'checkOutLocationAccuracy', 'checkInBatteryPercentage', 'checkOutBatteryPercentage', 'isChargingOnCheckIn', 'isChargingOnCheckOut', 'checkInLocationAltitude', 'checkOutLocationAltitude', 'checkInLocationSpeed', 'checkOutLocationSpeed', 'checkInLocationProvider', 'checkOutLocationProvider'],
        include: [
          ['id', 'visitId'],
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode']
        ]
      },
      where,
      include: [
        {
          model: db.VisitSummary,
          as: 'visitSummary',
          attributes: ['totalOrders', 'totalPayments', 'totalFeedbacks', 'totalImages'],
          where: {
            isDeleted: 0,
          },
          required: true,
        },
        {
          model: db.User,
          as: 'user',
          attributes: [],
          required: true,
          where: {
            isDeleted: 0,
          },
        },
      ],
      order: [sortBy && sortOrder ? [sortBy, sortOrder] : ['createdAt', 'DESC']],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Visit.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await Visit.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new VisitsReportRepository();
