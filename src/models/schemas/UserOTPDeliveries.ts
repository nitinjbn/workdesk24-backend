import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { BaseModel } from '../../shared/types/base.types';

interface UserOTPDeliveriesAttributes extends BaseModel {
  userId: number;
  hostId: number;
  otpId: number;
  deliveryChannel: string; // Channel through which the OTP was sent (e.g., 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH')
  destination: string; // Destination to which the OTP was sent (e.g., email address, mobile number, etc.)
  providerMessageId?: string | null; // Optional message ID returned by the notification service
  provider?: string | null; // Optional provider name (e.g., 'AWS_SES', 'TWILIO', etc.)
  status: string; // Status of the OTP delivery (e.g., 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', etc.)
  failureReason?: string | null; // Optional failure reason if the delivery failed
  sentAt?: number | null; // Timestamp when the OTP was sent
  deliveredAt?: number | null; // Timestamp when the OTP was delivered
}

interface UserOTPDeliveriesCreationAttributes extends Optional<UserOTPDeliveriesAttributes, 'id' | 'hostId' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class UserOTPDeliveries extends Model<UserOTPDeliveriesAttributes, UserOTPDeliveriesCreationAttributes> implements UserOTPDeliveriesAttributes {
  public id!: number;
  public userId!: number;
  public hostId!: number;
  public otpId!: number;
  public deliveryChannel!: string;
  public providerMessageId?: string | null;
  public status!: string;
  public createdAt!: number;
  public updatedAt!: number;
  public destination!: string;
  public provider?: string | null;
  public failureReason?: string | null;
  public sentAt?: number | null;
  public deliveredAt?: number | null;
  
  public static associate(models: any): void {
    UserOTPDeliveries.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    UserOTPDeliveries.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });

    UserOTPDeliveries.belongsTo(models.UserOTP, {
      foreignKey: 'otpId',
      as: 'otp',
    });
  }
}

export function initUserOTPDeliveries(sequelize: Sequelize): typeof UserOTPDeliveries {
  UserOTPDeliveries.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      otpId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      deliveryChannel: { // Channel through which the OTP was sent (e.g., 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH')
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      destination: { // Destination to which the OTP was sent (e.g., email address, mobile number, etc.)
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      providerMessageId: { // Optional message ID returned by the notification service
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      provider: { // Optional provider name (e.g., 'AWS_SES', 'TWILIO', etc.)
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      status: { // Status of the OTP delivery (e.g., 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', etc.)
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      failureReason: { // Optional failure reason if the delivery failed
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      sentAt: { // Timestamp when the OTP was sent
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deliveredAt: { // Timestamp when the OTP was delivered
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: 'wd_user_otp_deliveries',
      timestamps: false,
      underscored: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['otpId'] },
        { fields: ['deliveryChannel'] },
        { fields: ['providerMessageId'] }
      ],
      hooks: {
        beforeCreate: async (userOtp: UserOTPDeliveries) => {
          const now = Math.floor(Date.now() / 1000);
          userOtp.createdAt = now;
        },
        beforeUpdate: async (userOtp: UserOTPDeliveries) => {
          userOtp.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }
  );

  return UserOTPDeliveries;
}

export default UserOTPDeliveries;