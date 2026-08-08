import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';
import { ActivityModule } from '../../config/logActivity';
interface ActivityLogAttributes extends BaseModel {
  hostId: number;
  userId: number;
  module: ActivityModule;
  action: string;
  entityId: number;
  descriptionKey: string; // "VISIT_CHECKIN" | "VISIT_CHECKOUT" | "ORDER_PLACED" | "PAYMENT_RECEIVED" | "FEEDBACK_SUBMITTED" | "IMAGE_UPLOADED"
  metadata: Record<string, unknown>;
  activityTime: number;
  createdAt: number;
}
interface ActivityLogCreationAttributes extends Optional<ActivityLogAttributes, 'id' | 'hostId' | 'userId' | 'entityId' | 'metadata' | 'createdAt' > {}

class ActivityLog extends Model<ActivityLogAttributes, ActivityLogCreationAttributes> implements ActivityLogAttributes {
  public id!: number;
  public hostId: number;
  public userId: number;
  public module: ActivityModule;
  public action: string;
  public entityId: number ;
  public descriptionKey: string;
  public metadata: Record<string, unknown>;
  public activityTime: number;
  public createdAt: number;

  public static associate(models: any): void {
    ActivityLog.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    ActivityLog.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initActivityLog(sequelize: Sequelize): typeof ActivityLog {
  ActivityLog.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
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
      module: {
        type: DataTypes.ENUM(...Object.values(ActivityModule)),
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.BIGINT, 
        allowNull: false,
      },
      descriptionKey: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      activityTime: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true // Composite primary key with 'id' due to partitioning strategy
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      }
    },
    {
      sequelize,
      tableName: 'wd_activity_logs',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeCreate: (activityLog: ActivityLog) => {
            const now = new Date();
            const unix = Math.floor(now.getTime() / 1000);

            activityLog.createdAt ??= unix;
        },
      },
      indexes: [
        {
          name: 'idx_host_activity_time',
          fields: ['hostId', 'activityTime'],
        },
        {
          name: 'idx_host_user_activity_time',
          fields: ['hostId', 'userId', 'activityTime'],
        },
      ]
    }
  );

  return ActivityLog;
}

export default ActivityLog;