import { Transaction, WhereOptions } from 'sequelize';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import UserDailySummary from '../../../models/schemas/UserDailySummary';

export class UserDailySummaryRepository extends BaseRepository<typeof UserDailySummary.prototype> {
  constructor() {
    super(UserDailySummary as any);
  }

  async findByReportDate(
    hostId: number,
    userId: number,
    reportDate: number,
    transaction?: Transaction
  ): Promise<typeof UserDailySummary.prototype | null> {
    return this.findOne({
      hostId,
      userId,
      reportDate,
    } as WhereOptions<typeof UserDailySummary.prototype>, transaction);
  }
}
