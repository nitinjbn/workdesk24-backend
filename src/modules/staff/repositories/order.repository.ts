import { BaseRepository } from '../../../shared/repositories/base.repository';
import Order from '../../../models/schemas/Order';
import { WhereOptions, Op } from 'sequelize';

export class OrderRepository extends BaseRepository<typeof Order.prototype> {
  constructor() {
    super(Order as any);
  }

  async findByUserId(userId: number): Promise<typeof Order.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Order.prototype>,
      order: [['orderDate', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Order.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Order.prototype>);
  }

  async findByDateRange(userId: number, startDate: number, endDate: number): Promise<typeof Order.prototype[]> {
    return this.findAll({
      where: {
        userId,
        orderDate: {
          [Op.between]: [startDate, endDate],
        },
      } as WhereOptions<typeof Order.prototype>,
      order: [['orderDate', 'DESC']],
    });
  }
}

export default new OrderRepository();
