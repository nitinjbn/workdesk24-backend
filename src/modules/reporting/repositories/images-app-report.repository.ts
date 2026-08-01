import { FindAndCountOptions, Op } from 'sequelize';
import db from '../../../models';
import { ReportResponse } from '../types/report.types';


export class ImagesReportRepository {
  async getImagesReport(params: { hostId: number; userId?: number; filter?: { capturedAt?: { fromDate: number; tillDate: number }; customerId?: number } }): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;

    const visitWhere: Record<string, any> = { hostId, isDeleted: 0 };
    const imageWhere: Record<string, any> = { hostId, isDeleted: 0 };

    if (userId) {
      visitWhere.userId = userId;
      imageWhere.userId = userId;
    }

    if (filter) {
      if (filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if (filter?.capturedAt?.fromDate && filter.capturedAt?.tillDate) {
        imageWhere.capturedAt = {
          [Op.gte]: filter.capturedAt.fromDate,
          [Op.lte]: filter.capturedAt.tillDate,
        };
      }
    }

    const query: FindAndCountOptions<any> = {
      attributes: ['customerId', 'customerName', 'customerCode', 'contactPerson', 'customerPhone', 'customerEmail', 'customerType', 'checkInTime', 'checkOutTime', 'purpose', 'remarks'],
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
          model: db.Image,
          attributes: ['id', 'caption', 'mediaUrl', 'mediaType', 'capturedAt', 'address'],
          required: true,
          where: imageWhere,
          as: 'images',
        },
      ],
      order: [['checkInTime', 'DESC'], [{ model: db.Image, as: 'images' }, 'capturedAt', 'DESC']],
      distinct: true,
    };

    const rows = await db.Visit.findAll(query);
    return {
      data: rows,
    };
  }
}

export default new ImagesReportRepository();
