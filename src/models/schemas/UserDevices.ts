import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

interface UserDeviceAttributes {
  id: number;
  hostId: number;
  userId: number;
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  manufacturer: string;
  brand: string;
  device: string;
  product: string;
  hardware?: string | null;
  osVersion: string;
  sdkInt: number;
  appVersion?: string | null;
  storageTotalBytes?: number | null;
  storageAvailableBytes?: number | null;
  storageUsedBytes?: number | null;
  fcmToken?: string | null;
  createdAt: number;
  updatedAt?: number | null;
}

interface UserDeviceCreationAttributes
  extends Optional<UserDeviceAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class UserDevice
  extends Model<UserDeviceAttributes, UserDeviceCreationAttributes>
  implements UserDeviceAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public deviceId!: string;
  public deviceName!: string;
  public deviceModel!: string;
  public manufacturer!: string;
  public brand!: string;
  public device!: string;
  public product!: string;
  public hardware?: string | null;
  public osVersion!: string;
  public sdkInt!: number;
  public appVersion?: string | null;
  public storageTotalBytes?: number | null;
  public storageAvailableBytes?: number | null;
  public storageUsedBytes?: number | null;
  public fcmToken?: string | null;
  public createdAt!: number;
  public updatedAt?: number | null;

  public static associate(models: any): void {
    UserDevice.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });

    UserDevice.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initUserDevice(sequelize: Sequelize): typeof UserDevice {
  UserDevice.init(
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
      deviceName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      deviceModel: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      manufacturer: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      brand: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      device: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      product: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      hardware: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      osVersion: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      sdkInt: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      storageTotalBytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      storageAvailableBytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      storageUsedBytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      fcmToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      tableName: 'wd_user_devices',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeCreate: (device: UserDevice) => {
          const now = Math.floor(Date.now() / 1000);

          if (!device.createdAt) {
            device.createdAt = now;
          }
        },

        beforeUpdate: (device: UserDevice) => {
          device.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { unique: true, fields: ['hostId', 'userId', 'deviceId'] },
        { fields: ['deviceId'] }
      ]
    }
  );

  return UserDevice;
}

export default UserDevice;