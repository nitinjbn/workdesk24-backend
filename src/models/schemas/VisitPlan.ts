import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

export type VisitPlanStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface VisitPlanAttributes extends BaseModel {
  hostId: number;
  customerId: number;
  customerLocalId?: string | null;
  assignedUserId: number;
  scheduledDate: number;
  scheduledTime?: string | null;
  remarks?: string | null;
  status: VisitPlanStatus;
  checkInVisitId?: number | null;
  checkInAt?: number | null;
  completedAt?: number | null;
  cancelledAt?: number | null;
  cancellationRemarks?: string | null;
  idempotencyKey?: string | null;
  idempotencyRequestHash?: string | null;
  rescheduleRevision: number;
  createdBy: number;
}

interface VisitPlanCreationAttributes
  extends Optional<
    VisitPlanAttributes,
    | 'id'
    | 'customerLocalId'
    | 'scheduledTime'
    | 'remarks'
    | 'checkInVisitId'
    | 'checkInAt'
    | 'completedAt'
    | 'cancelledAt'
    | 'cancellationRemarks'
    | 'idempotencyKey'
    | 'idempotencyRequestHash'
    | 'rescheduleRevision'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

class VisitPlan
  extends Model<VisitPlanAttributes, VisitPlanCreationAttributes>
  implements VisitPlanAttributes
{
  public id!: number;
  public hostId!: number;
  public customerId!: number;
  public customerLocalId?: string | null;
  public assignedUserId!: number;
  public scheduledDate!: number;
  public scheduledTime?: string | null;
  public remarks?: string | null;
  public status!: VisitPlanStatus;
  public checkInVisitId?: number | null;
  public checkInAt?: number | null;
  public completedAt?: number | null;
  public cancelledAt?: number | null;
  public cancellationRemarks?: string | null;
  public idempotencyKey?: string | null;
  public idempotencyRequestHash?: string | null;
  public rescheduleRevision!: number;
  public createdBy!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;

  public toJSON<T extends VisitPlanAttributes>(): T {
    const result = super.toJSON<T>();
    Reflect.deleteProperty(result, 'idempotencyRequestHash');
    return result;
  }

  public static associate(models: any): void {
    VisitPlan.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    VisitPlan.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    VisitPlan.belongsTo(models.User, { foreignKey: 'assignedUserId', as: 'assignedUser' });
    VisitPlan.belongsTo(models.Visit, { foreignKey: 'checkInVisitId', as: 'checkInVisit' });
    VisitPlan.hasMany(models.VisitPlanHistory, { foreignKey: 'visitId', as: 'history' });
  }
}

export function initVisitPlan(sequelize: Sequelize): typeof VisitPlan {
  VisitPlan.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: { type: DataTypes.BIGINT, allowNull: false },
      customerId: { type: DataTypes.BIGINT, allowNull: false },
      customerLocalId: { type: DataTypes.STRING(100), allowNull: true },
      assignedUserId: { type: DataTypes.BIGINT, allowNull: false },
      scheduledDate: { type: DataTypes.BIGINT, allowNull: false },
      scheduledTime: { type: DataTypes.STRING(5), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
      checkInVisitId: { type: DataTypes.BIGINT, allowNull: true },
      checkInAt: { type: DataTypes.BIGINT, allowNull: true },
      completedAt: { type: DataTypes.BIGINT, allowNull: true },
      cancelledAt: { type: DataTypes.BIGINT, allowNull: true },
      cancellationRemarks: { type: DataTypes.TEXT, allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(100), allowNull: true },
      idempotencyRequestHash: { type: DataTypes.STRING(64), allowNull: true },
      rescheduleRevision: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      createdBy: { type: DataTypes.BIGINT, allowNull: false },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: true },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_customer_visit_plans',
      timestamps: false,
      indexes: [
        { fields: ['hostId', 'customerId', 'scheduledDate', 'status'] },
        { fields: ['hostId', 'assignedUserId', 'scheduledDate'] },
        { fields: ['hostId', 'status'] },
        { unique: true, fields: ['hostId', 'idempotencyKey'] },
      ],
    }
  );

  return VisitPlan;
}

export default VisitPlan;
