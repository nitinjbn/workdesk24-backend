import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
interface TaskSettingsAttributes {
  id: number;
  hostId: number;
  taskNumberPrefix: string;
  nextTaskNumber: number | string;
  createdAt: number;
  updatedAt?: number;
}

interface TaskCreationAttributes extends Optional<
  TaskSettingsAttributes,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
> {}

class TaskSettings extends Model<TaskSettingsAttributes, TaskCreationAttributes> implements TaskSettingsAttributes {
  public id!: number;
  public hostId!: number;
  public taskNumberPrefix!: string;
  public nextTaskNumber!: number | string;
  public createdAt!: number;
  public updatedAt!: number;

  public static associate(models: any): void {
    TaskSettings.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initTaskSettings(sequelize: Sequelize): typeof TaskSettings {
  TaskSettings.init(
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
      taskNumberPrefix: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      nextTaskNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'wd_task_settings',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId'],
          name: 'uq_wd_task_settings_hostId',
        },
      ],
    }
  );

  return TaskSettings;
}

export default TaskSettings;
