import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Order, OrderProduct } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetOrdersReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class OrdersReportRepository {
  async getOrdersReport(params: GetOrdersReportPayload): Promise<ReportResponse<any>> {
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
      if(filter.orderTime) {
        where.orderTime = {
          [Op.gte]: filter.orderTime?.from,
          [Op.lte]: filter.orderTime?.to,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'locationAccuracy', 'batteryPercentage', 'isCharging', 'locationAltitude', 'locationSpeed', 'locationProvider', 'locationProvider'],
        include: [
          ['id', 'orderId'],
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode']
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
      order: [sortBy && sortOrder ? [sortBy, sortOrder] : ['createdAt', 'DESC']],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Order.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await Order.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new OrdersReportRepository();
