import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { OrderAttributes } from '../../types';

interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'localId' | 'orderNumber' | 'customerPhone' | 'customerEmail' | 'deliveryAddress' | 'items' | 'taxAmount' | 'discountAmount' | 'deliveryDate' | 'notes' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public orderNumber?: string;
  public customerName!: string;
  public customerPhone?: string;
  public customerEmail?: string;
  public deliveryAddress?: string;
  public items?: any;
  public totalAmount!: number;
  public taxAmount?: number;
  public discountAmount?: number;
  public netAmount!: number;
  public status!: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  public paymentStatus!: 'pending' | 'partial' | 'paid' | 'refunded';
  public orderDate!: number;
  public deliveryDate?: number;
  public notes?: string;
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
  }
}

export function initOrder(sequelize: Sequelize): typeof Order {
  Order.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'local_id',
      },
      orderNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        field: 'order_number',
      },
      customerName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'customer_name',
      },
      customerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'customer_phone',
      },
      customerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'customer_email',
      },
      deliveryAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'delivery_address',
      },
      items: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'total_amount',
      },
      taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        field: 'tax_amount',
      },
      discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        field: 'discount_amount',
      },
      netAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'net_amount',
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending',
      },
      paymentStatus: {
        type: DataTypes.ENUM('pending', 'partial', 'paid', 'refunded'),
        defaultValue: 'pending',
        field: 'payment_status',
      },
      orderDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'order_date',
      },
      deliveryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'delivery_date',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        },
    },
    {
      sequelize,
      tableName: 'wd_orders',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['local_id'] },
        { fields: ['order_number'] },
        { fields: ['status'] },
        { fields: ['order_date'] },
      ],
    }
  );

  return Order;
}

export default Order;
