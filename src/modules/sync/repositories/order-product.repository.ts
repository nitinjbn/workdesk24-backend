import { Transaction, WhereOptions } from 'sequelize';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import type Order from '../../../models/schemas/Order';
import OrderProduct from '../../../models/schemas/OrderProduct';
import type { RevisedOrderProductInput } from '../types/revised-order.schema';

export class OrderProductRepository extends BaseRepository<typeof OrderProduct.prototype> {
  constructor() {
    super(OrderProduct as any);
  }

  async findByOrderId(orderId: number, transaction?: Transaction): Promise<typeof OrderProduct.prototype[]> {
    return this.findAll({
      where: { orderId } as WhereOptions<typeof OrderProduct.prototype>,
      transaction,
    });
  }

  async findForOrderUpdate(order: Order, transaction: Transaction): Promise<OrderProduct[]> {
    return this.findAll({
      where: { orderId: order.id, hostId: order.hostId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  async createRevisedProducts(
    order: Order,
    lines: { input?: RevisedOrderProductInput; existing?: OrderProduct }[],
    now: number,
    transaction: Transaction
  ): Promise<OrderProduct[]> {
    if (!lines.length) return [];

    await this.model.bulkCreate(lines.map(({ input, existing }) => {
      const { id: _oldId, ...original } = existing?.toJSON() ?? {};
      const { id: _inputId, ...details } = input ?? {};
      return {
        ...original,
        ...details,
        orderId: order.id,
        hostId: order.hostId,
        userId: order.userId,
        visitId: order.visitId,
        customerId: order.customerId,
        isDeleted: 0,
        deletedAt: null,
        createdAt: now,
        syncedAt: now,
        updatedAt: now,
      };
    }), { transaction, validate: true });

    return this.findAll({
      where: { orderId: order.id, hostId: order.hostId },
      order: [['id', 'ASC']],
      transaction,
    });
  }

  async replaceForOrder(orderId: number, userId: number, products: any[], syncedAt: number, transaction?: Transaction): Promise<void> {
    const existingProducts = await this.findByOrderId(orderId, transaction);

    for (const product of existingProducts) {
      await this.delete(product.id, transaction);
    }

    for (const product of products) {
      await this.create({
        ...product,
        orderId,
        userId,
        syncedAt,
      } as any, transaction);
    }
  }
}
