import { BaseRepository } from '../../../shared/repositories/base.repository';
import GpsHistory from '../../../models/schemas/GpsHistory';
import { WhereOptions, Op } from 'sequelize';

export class GpsHistoryRepository extends BaseRepository<typeof GpsHistory.prototype> {
  constructor() {
    super(GpsHistory as any);
  }

  async findByUserId(userId: number): Promise<typeof GpsHistory.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof GpsHistory.prototype>,
      order: [['timestamp', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof GpsHistory.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof GpsHistory.prototype>);
  }

  async findByDateRange(userId: number, startTime: number, endTime: number): Promise<typeof GpsHistory.prototype[]> {
    return this.findAll({
      where: {
        userId,
        timestamp: {
          [Op.between]: [startTime, endTime],
        },
      } as WhereOptions<typeof GpsHistory.prototype>,
      order: [['timestamp', 'DESC']],
    });
  }
}

export default new GpsHistoryRepository();
