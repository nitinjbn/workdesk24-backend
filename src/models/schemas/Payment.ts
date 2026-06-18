import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { PaymentAttributes } from '../../types';

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'orderId' | 'localId' | 'transactionId' | 'referenceNumber' | 'notes' | 'latitude' | 'longitude' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public userId!: number;
  public orderId?: number;
  public localId?: string;
  public transactionId?: string;
  public amount!: number;
  public paymentMethod!: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  public paymentDate!: number;
  public status!: 'pending' | 'completed' | 'failed' | 'refunded';
  public referenceNumber?: string;
  public notes?: string;
  public latitude?: number;
  public longitude?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Payment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Payment.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
  }
}

export function initPayment(sequelize: Sequelize): typeof Payment {
  Payment.init(
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
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'local_id',
      },
      transactionId: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'transaction_id',
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      paymentMethod: {
        type: DataTypes.ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'other'),
        allowNull: false,
        field: 'payment_method',
      },
      paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'payment_date',
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending',
      },
      referenceNumber: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'reference_number',
      },
      notes: {
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
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        },
    },
    {
      sequelize,
      tableName: 'wd_payments',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['order_id'] },
        { fields: ['local_id'] },
        { fields: ['transaction_id'] },
        { fields: ['payment_date'] },
      ],
    }
  );

  return Payment;
}

export default Payment;
