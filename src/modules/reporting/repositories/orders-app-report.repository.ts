import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Order, OrderProduct } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetOrdersReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class OrdersReportRepository {
  async getOrdersReport(params: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number }}): Promise<ReportResponse<any>> {
    const { hostId, userId, filter } = params;

    let where: Record<string, any> = { hostId, userId, isDeleted: 0 };
    let visitWhere: Record<string, any> = { isDeleted: 0 };
    if(filter) {
      if(filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if(filter.fromDate && filter.tillDate) {
        where.orderTime = {
          [Op.gte]: filter.fromDate,
          [Op.lte]: filter.tillDate,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'locationAccuracy', 'batteryPercentage', 'isCharging', 'locationAltitude', 'locationSpeed', 'locationProvider', 'locationProvider'],
        include: [
          ['id', 'orderId'],
        ]
      },
      where,
      include: [
        {
          model: OrderProduct,
          as: 'products',
          attributes: {
            include: ['productId', 'productName', 'quantity', 'mrp', 'discountPercentage', 'discountAmount', 'taxAmount', 'totalAmount'],
            exclude: ['id', 'hostId', 'userId', 'customerId', 'visitId', 'localId', 'orderId', 'createdAt', 'updatedAt', 'isDeleted', 'deletedAt', 'syncedAt'],
          },
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
      order: [['createdAt', 'DESC']],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    const rows = await Order.findAll(query);
    return {
      data: rows
    };
  }
}

export default new OrdersReportRepository();
