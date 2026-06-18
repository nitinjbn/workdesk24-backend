import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { PaymentAttributes } from '../../types';

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'localId' | 'latitude' | 'longitude' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public visitId!: number;
  public paymentCaptureTime?: number;
  public transactionId?: string;
  public amount!: number;
  public paymentDate!: number;
  public paymentMode!: string;
  public remarks?: string
  public chequeNumber?: string;
  public paymentProofImageUrl?: string;
  public latitude?: number;
  public longitude?: number;
  public locationAccuracy?: number;
  public locationAltitude?: number;
  public locationSpeed?: number;
  public locationProvider?: string;
  public batteryPercentage?: number;
  public isChargingOnPayment?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number | null;

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
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      paymentMode: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      paymentDate: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      chequeNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      transactionId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      paymentProofImageUrl: {
        type: DataTypes.STRING(255),
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
      isChargingOnPayment: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      paymentCaptureTime: {
        type: DataTypes.BIGINT,
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
      tableName: 'wd_payments',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['visitId'] },
        { fields: ['paymentDate'] }
      ],
    }
  );

  return Payment;
}

export default Payment;
