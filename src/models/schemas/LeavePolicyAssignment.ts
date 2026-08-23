import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeavePolicyAssignmentAttributes } from '../../types/leave.types';

interface LeavePolicyAssignmentCreationAttributes extends Optional<LeavePolicyAssignmentAttributes, 'id'> {}

class LeavePolicyAssignment extends Model<LeavePolicyAssignmentAttributes, LeavePolicyAssignmentCreationAttributes> implements LeavePolicyAssignmentAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public leavePolicyId!: number;
  public effectiveFrom!: number;
  public effectiveTill?: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt?: number | null;
  
  public static associate(models: any): void {
    LeavePolicyAssignment.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeavePolicyAssignment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    LeavePolicyAssignment.belongsTo(models.LeavePolicy, {
      foreignKey: 'leavePolicyId',
      as: 'leavePolicy',
    });
  }
}

export function initLeavePolicyAssignment(sequelize: Sequelize): typeof LeavePolicyAssignment {
  LeavePolicyAssignment.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      leavePolicyId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      effectiveFrom: {
        type: DataTypes.DATEONLY, // Start date of the leave policy in YYYY-MM-DD format
        allowNull: false,
      },
      effectiveTill: {
        type: DataTypes.DATEONLY, // End date of the leave policy in YYYY-MM-DD format (optional)
        allowNull: true,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
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
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_employee_leave_policies',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId', 'userId', 'leavePolicyId'],
          name: 'uk_employee_leave_policy_host_user_leave_policy',
        },
      ],
    }
  );

  return LeavePolicyAssignment;
}

export default LeavePolicyAssignment;