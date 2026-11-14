import { Model, ModelStatic, DataTypes, Sequelize, Optional, NonAttribute } from 'sequelize';
import type TaskTag from './TaskTag';

interface TaskTagMappingAttributes {
  id: number;
  hostId: number;
  taskId: number;
  tagId: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

type TaskTagMappingCreationAttributes = Optional<TaskTagMappingAttributes,
  'id' | 'isDeleted' | 'updatedAt' | 'deletedAt'>;

class TaskTagMapping extends Model<TaskTagMappingAttributes, TaskTagMappingCreationAttributes>
  implements TaskTagMappingAttributes {
  public id!: number;
  public hostId!: number;
  public taskId!: number;
  public tagId!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public deletedAt?: number | null;
  declare tag?: NonAttribute<TaskTag>;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    TaskTagMapping.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    TaskTagMapping.belongsTo(models.Task, { foreignKey: 'taskId', as: 'task' });
    TaskTagMapping.belongsTo(models.TaskTag, { foreignKey: 'tagId', as: 'tag' });
  }
}

export function initTaskTagMapping(sequelize: Sequelize): typeof TaskTagMapping {
  TaskTagMapping.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    taskId: { type: DataTypes.BIGINT, allowNull: false },
    tagId: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  }, {
    sequelize, tableName: 'wd_task_tag_mappings', timestamps: false,
    indexes: [
      { unique: true, fields: ['hostId', 'taskId', 'tagId'], name: 'uq_task_tag_mappings_host_task_tag' },
      { fields: ['hostId', 'taskId'], name: 'idx_task_tag_mappings_host_task' },
      { fields: ['hostId', 'tagId'], name: 'idx_task_tag_mappings_host_tag' },
    ],
  });
  return TaskTagMapping;
}

export default TaskTagMapping;
