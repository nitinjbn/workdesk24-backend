import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';

export interface TaskTagSummary {
  id: number;
  name: string;
  color: string;
  isEnabled: number;
  isDeleted: number;
}

export interface TaskTagAttributes extends TaskTagSummary {
  hostId: number;
  description?: string | null;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

type TaskTagCreationAttributes = Optional<TaskTagAttributes,
  'id' | 'description' | 'isEnabled' | 'isDeleted' | 'updatedAt' | 'deletedAt'>;

class TaskTag extends Model<TaskTagAttributes, TaskTagCreationAttributes> implements TaskTagAttributes {
  public id!: number;
  public hostId!: number;
  public name!: string;
  public color!: string;
  public description?: string | null;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public deletedAt?: number | null;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    TaskTag.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    TaskTag.hasMany(models.TaskTagMapping, { foreignKey: 'tagId', as: 'mappings' });
  }
}

export function initTaskTag(sequelize: Sequelize): typeof TaskTag {
  TaskTag.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    name: { type: DataTypes.STRING(50), allowNull: false },
    color: { type: DataTypes.STRING(7), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    isEnabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  }, {
    sequelize, tableName: 'wd_task_tags', timestamps: false,
    charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['hostId', 'isDeleted', 'isEnabled'], name: 'idx_task_tags_host_status' },
    ],
  });
  return TaskTag;
}

export default TaskTag;
