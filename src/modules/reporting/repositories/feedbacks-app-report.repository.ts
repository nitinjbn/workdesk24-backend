import { FindAndCountOptions, Op } from 'sequelize';
import db from '../../../models';
import { ReportResponse } from '../types/report.types';


export class FeedbacksReportRepository {
  async getFeedbacksReport(params: { hostId: number; userId?: number; filter?: { feedbackTime?: {fromDate: number; tillDate: number;}; customerId?: number }}): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;

    const visitWhere: Record<string, any> = { hostId, isDeleted: 0 };
    const feedbackWhere: Record<string, any> = { hostId, isDeleted: 0 };

    if (userId) {
      visitWhere.userId = userId;
      feedbackWhere.userId = userId;
    }

    if (filter) {
      if (filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if (filter?.feedbackTime?.fromDate && filter.feedbackTime?.tillDate) {
        feedbackWhere.feedbackTime = {
          [Op.gte]: filter.feedbackTime.fromDate,
          [Op.lte]: filter.feedbackTime.tillDate,
        };
      }
    }

    const query: FindAndCountOptions<any> = {
      attributes: ['customerName', 'customerCode', 'contactPerson', 'customerPhone', 'customerEmail', 'customerType', 'checkInTime', 'checkOutTime', 'purpose', 'remarks'],
      where: visitWhere,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: [],
          required: true,
          where: { isDeleted: 0 },
        },
        {
          model: db.Feedback,
          as: 'feedbacks',
          attributes: ['id', 'message', 'mediaUrl', 'mediaType', 'feedbackTime', 'address'],
          required: true,
          where: feedbackWhere,
        },
      ],
      order: [['checkInTime', 'DESC'], [{ model: db.Feedback, as: 'feedbacks' }, 'feedbackTime', 'DESC']],
      distinct: true,
    };

    const rows = await db.Visit.findAll(query);
    return {
      data: rows,
    };
  }
}

export default new FeedbacksReportRepository();
