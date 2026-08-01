import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Customer, CustomerAttribute, CustomerMedia, CustomerType, Visit } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetVisitsReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class VisitsReportRepository {
  async getVisitsReport(params: { hostId: number; userId?: number; filter?: { checkInTime?: { fromDate: number; tillDate: number }; customerId?: number };  }): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;

    let where: Record<string, any> = { hostId, userId, isDeleted: 0 };
    if(filter) {
      if(filter.customerId) {
        where.customerId = filter.customerId;
      }
      if(filter.checkInTime?.fromDate && filter.checkInTime?.tillDate) {
        where.checkInTime = {
          [Op.gte]: filter.checkInTime.fromDate,
          [Op.lte]: filter.checkInTime.tillDate,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: ["customerId", "customerName", "customerCode", "contactPerson", "customerPhone", "customerEmail", "customerType", "customerAddress", "checkInTime", "checkOutTime", "purpose", "remarks", "visitDuration", "checkInAddress", "checkOutAddress"],
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

  async getCustomerById(params: { hostId: number, customerId: number }): Promise<any> {
    const { hostId, customerId } = params;

    const where:any = {
      id: customerId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
        include: [
          [db.Sequelize.col('Customer.id'), 'customerId'],
          [db.Sequelize.col('customerTypeDetails.customerTypeName'), 'customerTypeName']
        ]
      },
      where,
      include:[
        {
          attributes:[],
          model: CustomerType,
          where: {
            isDeleted: 0
          },
          as: "customerTypeDetails",
          required: false
        },
        {
          attributes: {
            include: [["id", "mediaId"]],
            exclude: ['id', 'hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "customerMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerAttribute,
          where: {
            isDeleted: 0
          },
          as: "customerAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      logging: console.log, // Enable logging for debugging
    };

    const customerDetails = await Customer.findOne(query);
    return {
      data: customerDetails?.toJSON() || {}
    };
  }
}

export default new VisitsReportRepository();
