import { BaseRepository } from '../../../shared/repositories/base.repository';
import Order from '../../../models/schemas/Order';
import { WhereOptions, Op, Transaction } from 'sequelize';
import type { OrderDetails } from '../types/revised-order.schema';

export class OrderRepository extends BaseRepository<typeof Order.prototype> {
  constructor() {
    super(Order as any);
  }

  async findForUpdate(id: number, hostId: number, transaction: Transaction): Promise<Order | null> {
    return this.model.findOne({
      where: { id, hostId, isDeleted: 0 },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  async createRevision(
    order: Order,
    values: OrderDetails,
    syncedAt: number,
    transaction: Transaction
  ): Promise<Order> {
    const { id: _id, ...original } = order.toJSON();
    return this.model.create({
      ...original,
      ...values,
      isRevised: 1,
      revisedOrderId: null,
      isDeleted: 0,
      deletedAt: null,
      createdAt: syncedAt,
      syncedAt,
      updatedAt: syncedAt,
    }, { transaction });
  }

  async markReplaced(order: Order, revisedOrderId: number, now: number, transaction: Transaction) {
    await order.update(
      { isDeleted: 1, revisedOrderId, deletedAt: now, updatedAt: now },
      { transaction }
    );
  }

  async findForSync(hostId: number, userId: number, localId: string, transaction: Transaction) {
    return this.model.findOne({
      where: { hostId, userId, localId, isDeleted: 0 },
      order: [['id', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  async findByUserId(userId: number): Promise<(typeof Order.prototype)[]> {
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

  async findByDateRange(
    userId: number,
    startDate: number,
    endDate: number
  ): Promise<(typeof Order.prototype)[]> {
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

  async findLastOrderNumber(hostId: number, transaction?: Transaction): Promise<string | null> {
    const order = await this.model.findOne({
      attributes: ['orderNumber'],
      where: {
        hostId,
        isRevised: 0,
        [Op.or]: [{ isDeleted: 0 }, { revisedOrderId: { [Op.ne]: null } }],
      },
      order: [['id', 'DESC']],
      transaction,
    });

    return order?.orderNumber ?? null;
  }
}
