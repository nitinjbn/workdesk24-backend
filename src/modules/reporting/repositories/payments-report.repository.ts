import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Payment, OrderProduct } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetPaymentsReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class PaymentsReportRepository {
  async getPaymentsReport(params: GetPaymentsReportPayload): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });

    let where: Record<string, any> = { hostId, isDeleted: 0 };
    let visitWhere: Record<string, any> = { isDeleted: 0 };
    if(filter) {
      if(filter.userId) {
        where.userId = filter.userId;
      }
      if(filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if(filter.customerName?.trim()) {
        visitWhere.customerName = { [Op.like]: `%${filter.customerName?.trim()}%` };
      }
      if(filter.paymentCaptureTime) {
        where.paymentCaptureTime = {
          [Op.gte]: filter.paymentCaptureTime?.from,
          [Op.lte]: filter.paymentCaptureTime?.to,
        };
      }
      if(filter.visitId) {
        where.visitId = filter.visitId;
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'locationAccuracy', 'batteryPercentage', 'isCharging', 'locationAltitude', 'locationSpeed', 'locationProvider', 'locationProvider'],
        include: [
          ['id', 'paymentId'],
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
      order: [sortBy && sortOrder ? [sortBy, sortOrder] : ['createdAt', 'DESC']],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Payment.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await Payment.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new PaymentsReportRepository();
