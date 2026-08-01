import { FindAndCountOptions, Op } from 'sequelize';
import db from '../../../models';
import { ReportResponse } from '../types/report.types';


export class PaymentsReportRepository {
  async getPaymentsReport(params: { hostId: number; userId?: number; filter?: { paymentCaptureTime?: { fromDate: number; tillDate: number }; customerId?: number }}): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;

    const visitWhere: Record<string, any> = { hostId, isDeleted: 0 };
    const paymentWhere: Record<string, any> = { hostId, isDeleted: 0 };

    if (userId) {
      visitWhere.userId = userId;
      paymentWhere.userId = userId;
    }

    if (filter) {
      if (filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if (filter.paymentCaptureTime?.fromDate && filter.paymentCaptureTime?.tillDate) {
        paymentWhere.paymentCaptureTime = {
          [Op.gte]: filter.paymentCaptureTime.fromDate,
          [Op.lte]: filter.paymentCaptureTime.tillDate,
        };
      }
    }

    const query: FindAndCountOptions<any> = {
      attributes: ["customerId", "customerName", "customerCode", "contactPerson", "customerPhone", "customerEmail", "customerType"],
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
          model: db.Payment,
          as: 'payments',
          attributes: ["amount", "paymentMode", "paymentDate", "remarks", "chequeNumber", "transactionId", "paymentProofImageUrl", "paymentCaptureTime"],
          required: true,
          where: paymentWhere,
        },
      ],
      order: [['checkInTime', 'DESC'], [{ model: db.Payment, as: 'payments' }, 'paymentCaptureTime', 'DESC']],
      distinct: true,
    };

    const rows = await db.Visit.findAll(query);
    return {
      data: rows,
    };
  }
}

export default new PaymentsReportRepository();
