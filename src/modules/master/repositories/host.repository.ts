import { FindAndCountOptions, Op } from 'sequelize';
import db, { Host, HostSettings, HostSubscription } from '../../../models';
import { ReportResponse } from '../types/master.types';

export class hostRepository {
  async getHostCurrentSubscription(params: { hostId: number; currentDate: string }): Promise<any> {
    const { hostId, currentDate } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
      planStartDate: {
        [Op.lte]: currentDate,
      },
      planEndDate: {
        [Op.gte]: currentDate,
      },
    };

    const query: FindAndCountOptions<any> = {
      attributes: [
        'id',
        'hostId',
        'licensedUserCount',
        'planStartDate',
        'planEndDate',
        'isDeleted',
        'createdAt',
        'updatedAt',
      ],
      where,
      order: [['planStartDate', 'DESC']],
      logging: console.log, // Enable logging for debugging
    };

    const subscriptionDetails = await HostSubscription.findOne(query);
    return {
      data: subscriptionDetails?.toJSON() || {},
    };
  }
}

export default new hostRepository();
