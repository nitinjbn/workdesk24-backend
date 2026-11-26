import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

export type VisitPlanEventType =
  | 'VISIT_SCHEDULED'
  | 'VISIT_RESCHEDULED'
  | 'VISIT_CHECKED_IN'
  | 'VISIT_COMPLETED'
  | 'VISIT_CANCELLED';

export interface VisitPlanHistoryAttributes extends BaseModel {
  hostId: number;
  visitId: number;
  customerId: number;
  eventType: VisitPlanEventType;
  oldScheduledDate?: number | null;
  newScheduledDate?: number | null;
  oldScheduledTime?: string | null;
  newScheduledTime?: string | null;
  remarks?: string | null;
  performedBy: number;
  eventAt: number;
}

interface VisitPlanHistoryCreationAttributes
  extends Optional<
    VisitPlanHistoryAttributes,
    | 'id'
    | 'oldScheduledDate'
    | 'newScheduledDate'
    | 'oldScheduledTime'
    | 'newScheduledTime'
    | 'remarks'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

class VisitPlanHistory
  extends Model<VisitPlanHistoryAttributes, VisitPlanHistoryCreationAttributes>
  implements VisitPlanHistoryAttributes
{
  public id!: number;
  public hostId!: number;
  public visitId!: number;
  public customerId!: number;
  public eventType!: VisitPlanEventType;
  public oldScheduledDate?: number | null;
  public newScheduledDate?: number | null;
  public oldScheduledTime?: string | null;
  public newScheduledTime?: string | null;
  public remarks?: string | null;
  public performedBy!: number;
  public eventAt!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    VisitPlanHistory.belongsTo(models.VisitPlan, { foreignKey: 'visitId', as: 'visit' });
  }
}

export function initVisitPlanHistory(sequelize: Sequelize): typeof VisitPlanHistory {
  VisitPlanHistory.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: { type: DataTypes.BIGINT, allowNull: false },
      visitId: { type: DataTypes.BIGINT, allowNull: false },
      customerId: { type: DataTypes.BIGINT, allowNull: false },
      eventType: {
        type: DataTypes.ENUM(
          'VISIT_SCHEDULED',
          'VISIT_RESCHEDULED',
          'VISIT_CHECKED_IN',
          'VISIT_COMPLETED',
          'VISIT_CANCELLED'
        ),
        allowNull: false,
      },
      oldScheduledDate: { type: DataTypes.BIGINT, allowNull: true },
      newScheduledDate: { type: DataTypes.BIGINT, allowNull: true },
      oldScheduledTime: { type: DataTypes.STRING(5), allowNull: true },
      newScheduledTime: { type: DataTypes.STRING(5), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      performedBy: { type: DataTypes.BIGINT, allowNull: false },
      eventAt: { type: DataTypes.BIGINT, allowNull: false },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: true },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_customer_visit_plan_history',
      timestamps: false,
      indexes: [
        { fields: ['hostId', 'visitId', 'eventAt'] },
        { fields: ['hostId', 'customerId', 'eventAt'] },
      ],
    }
  );

  return VisitPlanHistory;
}

export default VisitPlanHistory;
