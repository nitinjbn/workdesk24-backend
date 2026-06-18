import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { OrderAttributes } from '../../types';

interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'localId' | 'orderNumber' | 'visitId' | 'customerId' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public visitId!: number;
  public customerId!: number;
  public orderNumber?: string;
  public totalAmount!: number;
  public taxAmount?: number;
  public totalDiscount?: number;
  public orderTime: number;
  public remarks?: string;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Order.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
    Order.hasMany(models.OrderProduct, {
      foreignKey: 'orderId',
      as: 'products',
    });
  }
}

export function initOrder(sequelize: Sequelize): typeof Order {
  Order.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
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
      orderNumber: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      totalDiscount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      totalUniqueProducts: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0,
      },
      totalQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      orderTime: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      locationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      batteryPercentage: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      isCharging: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      syncedAt: {
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
      tableName: 'wd_orders',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['customerId'] },
        { fields: ['visitId'] },
        { fields: ['orderNumber'] },
        { fields: ['orderTime'] },
      ],
    }
  );

  return Order;
}

export default Order;
