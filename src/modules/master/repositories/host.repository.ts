import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import db, { Host, HostSettings, HostSubscription } from '../../../models';
import { ReportResponse } from '../types/master.types';

export class hostRepository {
  async getHostSwitchContext(params: {
    hostId: number;
    currentDate: string;
    transaction?: Transaction;
    lock?: boolean;
  }): Promise<{
    host: typeof Host.prototype | null;
    subscription: typeof HostSubscription.prototype | null;
  }> {
    const { hostId, currentDate, transaction, lock } = params;
    const lockOption = lock && transaction ? transaction.LOCK.UPDATE : undefined;
    const host = await Host.findOne({
      where: { id: hostId, isActive: 1, isDeleted: 0 },
      transaction,
      lock: lockOption,
    });

    if (!host) {
      return { host: null, subscription: null };
    }

    const subscription = await HostSubscription.findOne({
      where: {
        hostId,
        isDeleted: 0,
        planStartDate: { [Op.lte]: currentDate },
        planEndDate: { [Op.gte]: currentDate },
      },
      attributes: [
        'id',
        'hostId',
        'planStartDate',
        'planEndDate',
        'isEnabled',
        'paymentStatus',
      ],
      order: [['planStartDate', 'DESC']],
      transaction,
      lock: lockOption,
    });

    return { host, subscription };
  }

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

  async getHostBySubDomain(params: { subDomain: string }): Promise<any> {
    const { subDomain } = params;
    if (!subDomain) {
      throw new Error('subDomain is required');
    }
    const hostDetails = await Host.findOne({ where: { subDomain, isDeleted: 0 } });
    return {
      data: hostDetails?.toJSON() || {},
    };
  }
}

export default new hostRepository();
