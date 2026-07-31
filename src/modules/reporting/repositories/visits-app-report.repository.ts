import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Visit } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetVisitsReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class VisitsReportRepository {
  async getVisitsReport(params: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number };  }): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;

    let where: Record<string, any> = { hostId, userId, isDeleted: 0 };
    if(filter) {
      if(filter.customerId) {
        where.customerId = filter.customerId;
      }
      if(filter.fromDate && filter.tillDate) {
        where.checkInTime = {
          [Op.gte]: filter.fromDate,
          [Op.lte]: filter.tillDate,
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
      order: [["checkInTime", "DESC"]],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };
    
    const rows = await Visit.findAll(query);
    return {
      data: rows
    };
  }
}

export default new VisitsReportRepository();
