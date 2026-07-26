import { Transaction, WhereOptions } from 'sequelize';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import OrderProduct from '../../../models/schemas/OrderProduct';

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
