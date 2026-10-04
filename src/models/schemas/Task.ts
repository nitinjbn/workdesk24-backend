import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
interface TaskAttributes {
  id: number;
  hostId: number;
  title: string;
  description?: string;
  assignedToUserId: number;
  createdByUserId: number;
  customerId?: number;
  visitId?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueAt?: number;
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

interface TaskCreationAttributes extends Optional<
  TaskAttributes,
  | 'id'
  | 'title'
  | 'description'
  | 'assignedToUserId'
  | 'createdByUserId'
  | 'customerId'
  | 'visitId'
  | 'priority'
  | 'status'
  | 'dueAt'
  | 'startedAt'
  | 'completedAt'
  | 'cancelledAt'
  | 'isDeleted'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
> {}

class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  public id!: number;
  public hostId!: number;
  public title: string;
  public description?: string;
  public assignedToUserId: number;
  public createdByUserId!: number;
  public customerId?: number;
  public visitId?: number;
  public priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  public status!: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  public dueAt?: number;
  public startedAt?: number;
  public completedAt?: number;
  public cancelledAt?: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Task.belongsTo(models.User, {
      foreignKey: 'assignedToUserId',
      as: 'assignedToUser',
    });

    Task.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      as: 'createdByUser',
    });

    Task.belongsTo(models.Customer, {
      foreignKey: 'customerId',
      as: 'customer',
    });

    Task.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
  }
}

export function initTask(sequelize: Sequelize): typeof Task {
  Task.init(
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
      title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      assignedToUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      createdByUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      visitId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
        allowNull: false,
        defaultValue: 'LOW',
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      dueAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_tasks',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['visitId'] },
        { fields: ['customerId'] },
        { fields: ['assignedToUserId'] },
        { fields: ['createdByUserId'] },
        { fields: ['priority'] },
        { fields: ['status'] },
        { fields: ['dueAt'] },
        { fields: ['startedAt'] },
        { fields: ['completedAt'] },
        { fields: ['cancelledAt'] },
      ],
    }
  );

  return Task;
}

export default Task;
