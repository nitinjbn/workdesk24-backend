import { BaseRepository } from '../../../shared/repositories/base.repository';
import Visit from '../../../models/schemas/Visit';
import { WhereOptions, Op } from 'sequelize';

export class VisitRepository extends BaseRepository<typeof Visit.prototype> {
  constructor() {
    super(Visit as any);
  }

  async findByUserId(userId: number): Promise<typeof Visit.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Visit.prototype>,
      order: [['visitTime', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Visit.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Visit.prototype>);
  }

  async findByDateRange(userId: number, startTime: number, endTime: number): Promise<typeof Visit.prototype[]> {
    return this.findAll({
      where: {
        userId,
        visitTime: {
          [Op.between]: [startTime, endTime],
        },
      } as WhereOptions<typeof Visit.prototype>,
      order: [['visitTime', 'DESC']],
    });
  }
}

export default new VisitRepository();
