import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Order, OrderProduct, Feedback } from '../../../models';
import { AttendanceReportFilter, CommonReportSortBy, ReportResponse, ReportSortDirection, GetFeedbacksReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class FeedbacksReportRepository {
  async getFeedbacksReport(params: GetFeedbacksReportPayload): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });

    let feedbackWhere: Record<string, any> = { hostId, isDeleted: 0 };
    let visitWhere: Record<string, any> = { isDeleted: 0 };
    if(filter) {
      if(filter.userId) {
        feedbackWhere.userId = filter.userId;
      }
      if(filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if(filter.customerName?.trim()) {
        visitWhere.customerName = { [Op.like]: `%${filter.customerName?.trim()}%` };
      }
      if(filter.feedbackTime) {
        feedbackWhere.feedbackTime = {
          [Op.gte]: filter.feedbackTime?.from,
          [Op.lte]: filter.feedbackTime?.to,
        };
      }
      if(filter.visitId) {
        feedbackWhere.visitId = filter.visitId;
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: [
        ['id', 'visitId'],
        'customerId',
        'customerName',
        'customerCode',
        'contactPerson',
        'customerPhone',
        'customerEmail',
        'checkInTime',
        [db.Sequelize.col('user.name'), 'employeeName'],
        [db.Sequelize.col('user.employeeCode'), 'employeeCode']
      ],
      where: visitWhere,
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
          model: db.Feedback,
          as: 'feedbacks',
          attributes: [
            ['id', 'feedbackId'],
            'message',
            'mediaUrl',
            'mediaType',
            'feedbackTime',
            'address'
          ],
          required: true,
          where: feedbackWhere,
        }
      ],
      order: [sortBy && sortOrder ? [sortBy, sortOrder] : ['checkInTime', 'DESC']],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await db.Visit.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await db.Visit.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new FeedbacksReportRepository();
