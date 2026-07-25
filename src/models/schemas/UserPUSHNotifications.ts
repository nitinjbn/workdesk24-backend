import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { BaseModel } from '../../shared/types/base.types';

interface UserPUSHNotificationsAttributes extends BaseModel {
  userId: number;
  hostId: number;
  deviceId: string;
  fcmToken: string; // Destination to which the OTP was sent (e.g., fcmToken etc.)
  notificationId?: string | null; // Unique identifier for the notification
  notificationType?: string | null; // Type of the notification (e.g., 'AUTH_OTP', 'INFO', etc.)
  payload?: Record<string, any> | null; // The payload sent in the push notification
  providerMessageId?: string | null; // Optional message ID returned by the notification service
  provider?: string | null; // Optional provider name (e.g., 'FIREBASE', etc.)
  status: string; // Status of the OTP delivery (e.g., 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', etc.)
  failureReason?: string | null; // Optional failure reason if the delivery failed
  sentAt?: number | null; // Timestamp when the OTP was sent
  deliveredAt?: number | null; // Timestamp when the OTP was delivered
  deliveryMode?: 'SILENT' | 'VISIBLE' | null; // Optional delivery mode (e.g., 'SILENT', 'VISIBLE')
  priority?: 'HIGH' | 'NORMAL' | null; // Optional priority (e.g., 'HIGH', 'NORMAL')
}

interface UserPUSHNotificationsCreationAttributes extends Optional<UserPUSHNotificationsAttributes, 'id' | 'hostId' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class UserPUSHNotifications extends Model<UserPUSHNotificationsAttributes, UserPUSHNotificationsCreationAttributes> implements UserPUSHNotificationsAttributes {
  public id!: number;
  public userId!: number;
  public hostId!: number;
  public deviceId!: string;
  public notificationId?: string | null;
  public notificationType?: string | null;
  public fcmToken!: string;
  public providerMessageId?: string | null;
  public status!: string;
  public provider?: string | null;
  public failureReason?: string | null;
  public sentAt?: number | null;
  public deliveredAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  public payload?: Record<string, any> | null;
  public deliveryMode?: 'SILENT' | 'VISIBLE' | null;
  public priority?: 'HIGH' | 'NORMAL' | null;

  public static associate(models: any): void {
    UserPUSHNotifications.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    UserPUSHNotifications.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initUserPUSHNotifications(sequelize: Sequelize): typeof UserPUSHNotifications {
  UserPUSHNotifications.init(
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
      deviceId: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      fcmToken: { // Destination to which the OTP was sent (e.g., fcmToken etc.)
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      notificationId: { // Unique identifier for the notification
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      notificationType: { // Type of the notification (e.g., 'AUTH_OTP', 'INFO', etc.)
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      payload: { // The payload sent in the push notification
        type: DataTypes.JSON,
        allowNull: true,
      },
      providerMessageId: { // Optional message ID returned by the notification service
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      provider: { // Optional provider name (e.g., 'FIREBASE', etc.)
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      status: { // Status of the OTP delivery (e.g., 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', etc.)
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      deliveryMode: {
        type: DataTypes.ENUM('SILENT', 'VISIBLE'),
        allowNull: true,
        defaultValue: null,
      },
      priority: {
        type: DataTypes.ENUM('HIGH', 'NORMAL'),
        allowNull: true,
        defaultValue: null,
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
      tableName: 'wd_user_push_notifications',
      timestamps: false,
      underscored: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['providerMessageId'] }
      ],
      hooks: {
        beforeCreate: async (userPushNotification: UserPUSHNotifications) => {
          const now = Math.floor(Date.now() / 1000);
          userPushNotification.createdAt = now;
        },
        beforeUpdate: async (userPushNotification: UserPUSHNotifications) => {
          userPushNotification.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }
  );

  return UserPUSHNotifications;
}

export default UserPUSHNotifications;