import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Order, OrderProduct, Feedback } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetFeedbacksReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class FeedbacksReportRepository {
  async getFeedbacksReport(params: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number }}): Promise<ReportResponse<any>> {
    const { filter, hostId, userId} = params;

    let where: Record<string, any> = { hostId, userId, isDeleted: 0 };
    let visitWhere: Record<string, any> = { isDeleted: 0 };
    if(filter) {
      if(filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if(filter.fromDate && filter.tillDate) {
        where.feedbackTime = {
          [Op.gte]: filter.fromDate,
          [Op.lte]: filter.tillDate,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'locationAccuracy', 'batteryPercentage', 'isChargingOnFeedback', 'locationAltitude', 'locationSpeed', 'locationProvider', 'locationProvider'],
        include: [
          ['id', 'feedbackId'],
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode']
        ]
      },
      where,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: [],
          required: true,
          where: {
            isDeleted: 0,
          },
        },
        {
          model: db.Visit,
          as: 'visit',
          attributes: {
            exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'checkInLocationAccuracy', 'checkOutLocationAccuracy', 'checkInBatteryPercentage', 'checkOutBatteryPercentage', 'isChargingOnCheckIn', 'isChargingOnCheckOut', 'checkInLocationAltitude', 'checkOutLocationAltitude', 'checkInLocationSpeed', 'checkOutLocationSpeed', 'checkInLocationProvider', 'checkOutLocationProvider'],
          },
          required: true,
          where: visitWhere,
        }
      ],
      order: [["feedbackTime", "DESC"]],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    const rows = await Feedback.findAll(query);
    return {
      data: rows
    };
  }
}

export default new FeedbacksReportRepository();
