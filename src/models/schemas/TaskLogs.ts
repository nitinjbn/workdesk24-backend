import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
interface TaskLogsAttributes {
  id: number;
  hostId: number;
  taskId: number;
  action: 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'REASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  performedByUserId: number;
  oldStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  oldAssignedToUserId?: number;
  newAssignedToUserId?: number;
  remarks?: string;
  createdAt: number;
}

interface TaskLogsCreationAttributes extends Optional<
  TaskLogsAttributes,
  'id' | 'oldStatus' | 'newStatus' | 'oldAssignedToUserId' | 'newAssignedToUserId' | 'remarks'
> {}

class TaskLogs
  extends Model<TaskLogsAttributes, TaskLogsCreationAttributes>
  implements TaskLogsAttributes
{
  public id!: number;
  public hostId!: number;
  public taskId!: number;
  public action!:
    'CREATED' | 'UPDATED' | 'ASSIGNED' | 'REASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  public performedByUserId!: number;
  public oldStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  public newStatus!: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  public oldAssignedToUserId?: number;
  public newAssignedToUserId?: number;
  public remarks?: string;
  public createdAt!: number;

  public static associate(models: any): void {
    TaskLogs.belongsTo(models.Task, {
      foreignKey: 'taskId',
      as: 'task',
    });

    TaskLogs.belongsTo(models.User, {
      foreignKey: 'performedByUserId',
      as: 'performedByUser',
    });

    TaskLogs.belongsTo(models.User, {
      foreignKey: 'oldAssignedToUserId',
      as: 'oldAssignedToUser',
    });

    TaskLogs.belongsTo(models.User, {
      foreignKey: 'newAssignedToUserId',
      as: 'newAssignedToUser',
    });
  }
}

export function initTaskLogs(sequelize: Sequelize): typeof TaskLogs {
  TaskLogs.init(
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
      taskId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      action: {
        type: DataTypes.ENUM(
          'CREATED',
          'UPDATED',
          'ASSIGNED',
          'REASSIGNED',
          'STARTED',
          'COMPLETED',
          'CANCELLED'
        ),
        allowNull: false,
      },
      performedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      oldStatus: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: true,
      },
      newStatus: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
      },
      oldAssignedToUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      newAssignedToUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'wd_task_logs',
      timestamps: false,
      indexes: [{ fields: ['hostId'] }, { fields: ['taskId'] }, { fields: ['performedByUserId'] }],
    }
  );

  return TaskLogs;
}

export default TaskLogs;
