import { Transaction, WhereOptions } from 'sequelize';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import VisitSummary from '../../../models/schemas/VisitSummary';

export class VisitSummaryRepository extends BaseRepository<typeof VisitSummary.prototype> {
  constructor() {
    super(VisitSummary as any);
  }

  async findByVisit(
    hostId: number,
    userId: number,
    visitId: number,
    transaction?: Transaction
  ): Promise<typeof VisitSummary.prototype | null> {
    return this.findOne({
      hostId,
      userId,
      visitId,
    } as WhereOptions<typeof VisitSummary.prototype>, transaction);
  }
}
