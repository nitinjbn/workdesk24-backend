import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

interface TaskCommentsAttributes {
  id: number;
  hostId: number;
  taskId: number;
  userId: number;
  comment: string;
  createdAt: number;
}

interface TaskCommentsCreationAttributes extends Optional<TaskCommentsAttributes, 'id'> {}

class TaskComments
  extends Model<TaskCommentsAttributes, TaskCommentsCreationAttributes>
  implements TaskCommentsAttributes
{
  public id!: number;
  public hostId!: number;
  public taskId!: number;
  public userId!: number;
  public comment!: string;
  public createdAt!: number;

  public static associate(models: any): void {
    TaskComments.belongsTo(models.Task, {
      foreignKey: 'taskId',
      as: 'task',
    });

    TaskComments.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initTaskComments(sequelize: Sequelize): typeof TaskComments {
  TaskComments.init(
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

      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      comment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'wd_task_comments',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId'],
        },
        {
          fields: ['taskId'],
        },
        {
          fields: ['userId'],
        },
      ],
    }
  );

  return TaskComments;
}

export default TaskComments;
