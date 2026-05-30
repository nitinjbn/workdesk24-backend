import { BaseRepository } from '../../../shared/repositories/base.repository';
import Payment from '../../../models/schemas/Payment';
import { WhereOptions, Op } from 'sequelize';

export class PaymentRepository extends BaseRepository<typeof Payment.prototype> {
  constructor() {
    super(Payment as any);
  }

  async findByUserId(userId: number): Promise<typeof Payment.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Payment.prototype>,
      order: [['paymentDate', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Payment.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Payment.prototype>);
  }

  async findByDateRange(userId: number, startDate: number, endDate: number): Promise<typeof Payment.prototype[]> {
    return this.findAll({
      where: {
        userId,
        paymentDate: {
          [Op.between]: [startDate, endDate],
        },
      } as WhereOptions<typeof Payment.prototype>,
      order: [['paymentDate', 'DESC']],
    });
  }
}

export default new PaymentRepository();
