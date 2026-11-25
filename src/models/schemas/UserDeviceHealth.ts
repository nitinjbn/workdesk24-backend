import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';

type BigIntValue = number | string;

export interface UserDeviceHealthAttributes {
  id: BigIntValue;
  hostId: BigIntValue;
  userId: BigIntValue;
  deviceId: string;
  schemaVersion: number;
  sequence: BigIntValue;
  collectedAt: BigIntValue;
  receivedAt: BigIntValue;
  syncReason?: string | null;
  deviceModel?: string | null;
  manufacturer?: string | null;
  androidVersion?: string | null;
  sdkInt?: number | null;
  appVersion?: string | null;
  versionCode?: BigIntValue | null;
  locationPermission?: string | null;
  backgroundLocationPermission?: string | null;
  cameraPermission?: string | null;
  microphonePermission?: string | null;
  notificationPermission?: string | null;
  locationEnabled?: boolean | null;
  gpsProviderEnabled?: boolean | null;
  batteryOptimizationIgnored?: boolean | null;
  batterySaverEnabled?: boolean | null;
  backgroundRestricted?: boolean | null;
  appNotificationsEnabled?: boolean | null;
  trackingNotificationChannelEnabled?: boolean | null;
  trackingExpected?: boolean | null;
  trackingServiceRunning?: boolean | null;
  trackingStatus?: string | null;
  trackingIssue?: string | null;
  lastLocationFetchResult?: string | null;
  lastLocationFailureReason?: string | null;
  lastLocationFetchAt?: BigIntValue | null;
  lastSuccessfulLocationAt?: BigIntValue | null;
  lastLocationAccuracyMeters?: number | null;
  connected?: boolean | null;
  internetValidated?: boolean | null;
  networkType?: string | null;
  createdAt: BigIntValue;
  updatedAt?: BigIntValue | null;
  isDeleted: number;
  deletedAt?: BigIntValue | null;
}

type UserDeviceHealthCreationAttributes = Optional<UserDeviceHealthAttributes, 'id' | 'isDeleted'>;

class UserDeviceHealth
  extends Model<UserDeviceHealthAttributes, UserDeviceHealthCreationAttributes>
  implements UserDeviceHealthAttributes {
  public id!: BigIntValue;
  public hostId!: BigIntValue;
  public userId!: BigIntValue;
  public deviceId!: string;
  public schemaVersion!: number;
  public sequence!: BigIntValue;
  public collectedAt!: BigIntValue;
  public receivedAt!: BigIntValue;
  public syncReason?: string | null;
  public deviceModel?: string | null;
  public manufacturer?: string | null;
  public androidVersion?: string | null;
  public sdkInt?: number | null;
  public appVersion?: string | null;
  public versionCode?: BigIntValue | null;
  public locationPermission?: string | null;
  public backgroundLocationPermission?: string | null;
  public cameraPermission?: string | null;
  public microphonePermission?: string | null;
  public notificationPermission?: string | null;
  public locationEnabled?: boolean | null;
  public gpsProviderEnabled?: boolean | null;
  public batteryOptimizationIgnored?: boolean | null;
  public batterySaverEnabled?: boolean | null;
  public backgroundRestricted?: boolean | null;
  public appNotificationsEnabled?: boolean | null;
  public trackingNotificationChannelEnabled?: boolean | null;
  public trackingExpected?: boolean | null;
  public trackingServiceRunning?: boolean | null;
  public trackingStatus?: string | null;
  public trackingIssue?: string | null;
  public lastLocationFetchResult?: string | null;
  public lastLocationFailureReason?: string | null;
  public lastLocationFetchAt?: BigIntValue | null;
  public lastSuccessfulLocationAt?: BigIntValue | null;
  public lastLocationAccuracyMeters?: number | null;
  public connected?: boolean | null;
  public internetValidated?: boolean | null;
  public networkType?: string | null;
  public createdAt!: BigIntValue;
  public updatedAt?: BigIntValue | null;
  public isDeleted!: number;
  public deletedAt?: BigIntValue | null;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    UserDeviceHealth.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host', constraints: false });
    UserDeviceHealth.belongsTo(models.User, { foreignKey: 'userId', as: 'user', constraints: false });
  }
}

export function initUserDeviceHealth(sequelize: Sequelize): typeof UserDeviceHealth {
  UserDeviceHealth.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    userId: { type: DataTypes.BIGINT, allowNull: false },
    deviceId: { type: DataTypes.STRING(255), allowNull: false },
    schemaVersion: { type: DataTypes.INTEGER, allowNull: false },
    sequence: { type: DataTypes.BIGINT, allowNull: false },
    collectedAt: { type: DataTypes.BIGINT, allowNull: false },
    receivedAt: { type: DataTypes.BIGINT, allowNull: false },
    syncReason: { type: DataTypes.STRING(64), allowNull: true },
    deviceModel: { type: DataTypes.STRING(100), allowNull: true },
    manufacturer: { type: DataTypes.STRING(100), allowNull: true },
    androidVersion: { type: DataTypes.STRING(50), allowNull: true },
    sdkInt: { type: DataTypes.SMALLINT, allowNull: true },
    appVersion: { type: DataTypes.STRING(64), allowNull: true },
    versionCode: { type: DataTypes.BIGINT, allowNull: true },
    locationPermission: { type: DataTypes.STRING(64), allowNull: true },
    backgroundLocationPermission: { type: DataTypes.STRING(64), allowNull: true },
    cameraPermission: { type: DataTypes.STRING(64), allowNull: true },
    microphonePermission: { type: DataTypes.STRING(64), allowNull: true },
    notificationPermission: { type: DataTypes.STRING(64), allowNull: true },
    locationEnabled: { type: DataTypes.BOOLEAN, allowNull: true },
    gpsProviderEnabled: { type: DataTypes.BOOLEAN, allowNull: true },
    batteryOptimizationIgnored: { type: DataTypes.BOOLEAN, allowNull: true },
    batterySaverEnabled: { type: DataTypes.BOOLEAN, allowNull: true },
    backgroundRestricted: { type: DataTypes.BOOLEAN, allowNull: true },
    appNotificationsEnabled: { type: DataTypes.BOOLEAN, allowNull: true },
    trackingNotificationChannelEnabled: { type: DataTypes.BOOLEAN, allowNull: true },
    trackingExpected: { type: DataTypes.BOOLEAN, allowNull: true },
    trackingServiceRunning: { type: DataTypes.BOOLEAN, allowNull: true },
    trackingStatus: { type: DataTypes.STRING(64), allowNull: true },
    trackingIssue: { type: DataTypes.STRING(255), allowNull: true },
    lastLocationFetchResult: { type: DataTypes.STRING(64), allowNull: true },
    lastLocationFailureReason: { type: DataTypes.STRING(255), allowNull: true },
    lastLocationFetchAt: { type: DataTypes.BIGINT, allowNull: true },
    lastSuccessfulLocationAt: { type: DataTypes.BIGINT, allowNull: true },
    lastLocationAccuracyMeters: { type: DataTypes.DOUBLE, allowNull: true },
    connected: { type: DataTypes.BOOLEAN, allowNull: true },
    internetValidated: { type: DataTypes.BOOLEAN, allowNull: true },
    networkType: { type: DataTypes.STRING(64), allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true },
  }, {
    sequelize,
    tableName: 'wd_user_device_health',
    timestamps: false,
    underscored: false,
    indexes: [
      { name: 'uk_device_health_host_user_device', unique: true, fields: ['hostId', 'userId', 'deviceId'] },
    ],
  });

  return UserDeviceHealth;
}

export default UserDeviceHealth;
