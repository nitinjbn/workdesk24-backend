import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface VisitPlanRescheduleOperationAttributes {
  id: number;
  hostId: number;
  userId: number;
  visitId: number;
  keyHash: string;
  requestHash: string;
  result: string;
  createdAt: number;
}

export type VisitPlanRescheduleOperationCreationAttributes =
  Optional<VisitPlanRescheduleOperationAttributes, 'id'>;

class VisitPlanRescheduleOperation
  extends Model<
    VisitPlanRescheduleOperationAttributes,
    VisitPlanRescheduleOperationCreationAttributes
  >
  implements VisitPlanRescheduleOperationAttributes
{
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public visitId!: number;
  public keyHash!: string;
  public requestHash!: string;
  public result!: string;
  public createdAt!: number;
}

export function initVisitPlanRescheduleOperation(sequelize: Sequelize): typeof VisitPlanRescheduleOperation {
  VisitPlanRescheduleOperation.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: {
        type: DataTypes.BIGINT, allowNull: false,
        references: { model: 'wd_hosts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      userId: {
        type: DataTypes.BIGINT, allowNull: false,
        references: { model: 'wd_users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      visitId: {
        type: DataTypes.BIGINT, allowNull: false,
        references: { model: 'wd_customer_visit_plans', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      keyHash: { type: DataTypes.STRING(64), allowNull: false },
      requestHash: { type: DataTypes.STRING(64), allowNull: false },
      result: { type: DataTypes.TEXT('long'), allowNull: false },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
    },
    {
      sequelize,
      tableName: 'wd_visit_plan_reschedule_operations',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId', 'userId', 'keyHash'],
          unique: true,
          name: 'visit_plan_reschedule_owner_key',
        },
      ],
    }
  );

  return VisitPlanRescheduleOperation;
}

export default VisitPlanRescheduleOperation;
