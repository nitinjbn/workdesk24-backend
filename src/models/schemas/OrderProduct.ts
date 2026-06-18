import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { OrderProductAttributes } from '../../types';

interface OrderProductCreationAttributes extends Optional<OrderProductAttributes, 'id' | 'localId' | 'productId' | 'productCode' | 'taxAmount' | 'discountAmount' | 'totalAmount' | 'syncedAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class OrderProduct extends Model<OrderProductAttributes, OrderProductCreationAttributes> implements OrderProductAttributes {
  public id!: number;
  public orderId!: number;
  public userId!: number;
  public localId?: string;
  public productId?: number;
  public productName!: string;
  public productCode?: string;
  public description?: string;
  public quantity!: number;
  public unitPrice?: number;
  public taxAmount?: number;
  public discountAmount?: number;
  public totalAmount?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    OrderProduct.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order',
    });
    OrderProduct.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initOrderProduct(sequelize: Sequelize): typeof OrderProduct {
  OrderProduct.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      productId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      productCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      mrp: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      discountPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_orders_products',
      timestamps: false,
      indexes: [
        { fields: ['orderId'] },
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['productId'] },
        { fields: ['visitId'] },
        { fields: ['customerId'] },
      ],
    }
  );

  return OrderProduct;
}

export default OrderProduct;
