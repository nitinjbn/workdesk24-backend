import { BaseRepository } from '../../../shared/repositories/base.repository';
import Feedback from '../../../models/schemas/Feedback';
import { WhereOptions, Op } from 'sequelize';

export class FeedbackRepository extends BaseRepository<typeof Feedback.prototype> {
  constructor() {
    super(Feedback as any);
  }

  async findByUserId(userId: number): Promise<typeof Feedback.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Feedback.prototype>,
      order: [['feedbackDate', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Feedback.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Feedback.prototype>);
  }
}

export default new FeedbackRepository();
