import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';

interface TaskCategoryAttributes {
  id: number;
  hostId: number;
  name: string;
  description?: string | null;
  taskNumberPrefix: string;
  nextTaskNumber: number | string;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

type TaskCategoryCreationAttributes = Optional<TaskCategoryAttributes,
  'id' | 'description' | 'nextTaskNumber' | 'isEnabled' | 'isDeleted' | 'updatedAt' | 'deletedAt'>;

class TaskCategory extends Model<TaskCategoryAttributes, TaskCategoryCreationAttributes>
  implements TaskCategoryAttributes {
  public id!: number;
  public hostId!: number;
  public name!: string;
  public description?: string | null;
  public taskNumberPrefix!: string;
  public nextTaskNumber!: number | string;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public deletedAt?: number | null;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    TaskCategory.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    TaskCategory.hasMany(models.Task, { foreignKey: 'taskCategoryId', as: 'tasks' });
  }
}

export function initTaskCategory(sequelize: Sequelize): typeof TaskCategory {
  TaskCategory.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: true },
    taskNumberPrefix: { type: DataTypes.STRING(20), allowNull: false },
    nextTaskNumber: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 1 },
    isEnabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  }, {
    sequelize,
    tableName: 'wd_task_categories',
    timestamps: false,
    indexes: [
      { fields: ['hostId'] },
      { fields: ['isEnabled'] },
      { fields: ['isDeleted'] },
    ],
  });
  return TaskCategory;
}

export default TaskCategory;
