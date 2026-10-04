import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

interface TaskAttachmentsAttributes {
  id: number;
  hostId: number;
  taskId: number;
  taskCommentId?: number;
  uploadedByUserId: number;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileUrl: string;
  remarks?: string;
  createdAt: number;
}

interface TaskAttachmentsCreationAttributes extends Optional<
  TaskAttachmentsAttributes,
  'id' | 'remarks'
> {}

class TaskAttachments
  extends Model<TaskAttachmentsAttributes, TaskAttachmentsCreationAttributes>
  implements TaskAttachmentsAttributes
{
  public id!: number;
  public hostId!: number;
  public taskId!: number;
  public taskCommentId?: number;
  public uploadedByUserId!: number;
  public fileName!: string;
  public fileType!: string;
  public fileSizeBytes!: number;
  public fileUrl!: string;
  public remarks?: string;
  public createdAt!: number;

  public static associate(models: any): void {
    TaskAttachments.belongsTo(models.Task, {
      foreignKey: 'taskId',
      as: 'task',
    });

    TaskAttachments.belongsTo(models.User, {
      foreignKey: 'uploadedByUserId',
      as: 'uploadedByUser',
    });

    TaskAttachments.belongsTo(models.TaskComments, {
      foreignKey: 'taskCommentId',
      as: 'taskComment',
    });
  }
}

export function initTaskAttachments(sequelize: Sequelize): typeof TaskAttachments {
  TaskAttachments.init(
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

      taskCommentId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      uploadedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      fileName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      fileType: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      fileSizeBytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      fileUrl: {
        type: DataTypes.STRING(1000),
        allowNull: false,
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
      tableName: 'wd_task_attachments',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId'],
        },
        {
          fields: ['taskId'],
        },
        {
          fields: ['uploadedByUserId'],
        },
        {
          fields: ['taskCommentId'],
        },
      ],
    }
  );

  return TaskAttachments;
}

export default TaskAttachments;
