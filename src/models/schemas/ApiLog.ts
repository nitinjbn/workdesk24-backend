import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

interface ApiLogAttributes extends BaseModel {
  hostId?: number;
  userId?: number;
  deviceId?: string | null;
  source: 'ANDROID' | 'IOS' | 'WEB' | 'CRON' | 'SYSTEM';
  category: string;
  module: string;
  apiEndpoint: string;
  requestBody?: object;
  responseBody?: object;
  responseStatusCode?: number;
  requestSize?: number;
  responseSize?: number;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  errorMessage?: string | null;
  requestTime: number;
  requestDate: string;
  responseTime?: number | null;
  durationMilliseconds?: number | null;
  createdAt: number;
  updatedAt?: number | null;
  ipAddress?: string;
  userAgent?: string;
}
interface ApiLogCreationAttributes extends Optional<ApiLogAttributes, 'id' | 'hostId' | 'userId' | 'deviceId' | 'source' | 'category' | 'module' | 'apiEndpoint' | 'requestBody' | 'responseBody' | 'responseStatusCode' | 'requestSize' | 'responseSize' | 'status' | 'errorMessage' | 'requestTime' | 'requestDate' | 'responseTime' | 'durationMilliseconds' | 'createdAt' | 'updatedAt' | 'ipAddress' | 'userAgent'> {}

class ApiLog extends Model<ApiLogAttributes, ApiLogCreationAttributes> implements ApiLogAttributes {
  public id!: number;
  public hostId?: number;
  public userId?: number;
  public deviceId?: string | null;
  public source!: 'ANDROID' | 'IOS' | 'WEB' | 'CRON' | 'SYSTEM';
  public category!: string;
  public module!: string;
  public apiEndpoint!: string;
  public requestBody?: object;
  public responseBody?: object;
  public responseStatusCode?: number;
  public requestSize?: number;
  public responseSize?: number;
  public status!: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  public errorMessage?: string | null;
  public requestTime!: number;
  public responseTime?: number | null;
  public durationMilliseconds?: number | null;
  public requestDate!: string;
  public createdAt!: number;
  public updatedAt?: number | null;
  public ipAddress?: string;
  public userAgent?: string;

  public static associate(models: any): void {
    ApiLog.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    ApiLog.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initApiLog(sequelize: Sequelize): typeof ApiLog {
  ApiLog.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deviceId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      source: {
        type: DataTypes.ENUM('ANDROID', 'IOS', 'WEB', 'CRON', 'SYSTEM'),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      apiEndpoint: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      requestBody: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      responseBody: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      responseStatusCode: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      requestSize: {
        type: DataTypes.MEDIUMINT.UNSIGNED,
        allowNull: true,
      },
      responseSize: {
        type: DataTypes.MEDIUMINT.UNSIGNED,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('SUCCESS', 'FAILED', 'PROCESSING'),
        allowNull: false,
        defaultValue: 'PROCESSING',
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requestTime: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      responseTime: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      requestDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      durationMilliseconds: {
        type: DataTypes.MEDIUMINT.UNSIGNED,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: 'wd_api_logs',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeCreate: (apiLog: ApiLog) => {
            const now = new Date();
            const unix = Math.floor(now.getTime() / 1000);

            apiLog.createdAt ??= unix;
            apiLog.requestTime ??= unix;
            apiLog.requestDate ??= now.toISOString().slice(0, 10); // UTC date
        },
        beforeUpdate: async (apiLog: ApiLog) => {
          apiLog.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
      indexes: [
        {
          name: 'idx_host_date',
          fields: ['hostId', 'requestDate'],
        },
        {
          name: 'idx_host_user_date',
          fields: ['hostId', 'userId', 'requestDate'],
        },
        {
          name: 'idx_status_date',
          fields: ['status', 'requestDate'],
        },
        {
          name: 'idx_category_module_date',
          fields: ['category', 'module', 'requestDate'],
        },
        {
          name: 'idx_device_date',
          fields: ['deviceId', 'requestDate'],
        },
      ]
    }
  );

  return ApiLog;
}

export default ApiLog;