import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeavePolicyRuleAttributes } from '../../types/leave.types';

interface LeavePolicyRuleCreationAttributes extends Optional<LeavePolicyRuleAttributes, 'id'> {}

class LeavePolicyRule extends Model<LeavePolicyRuleAttributes, LeavePolicyRuleCreationAttributes> implements LeavePolicyRuleAttributes {
  public id!: number;
  public hostId!: number;
  public leavePolicyId!: number;
  public leaveTypeId!: number;
  public annualEntitlement!: number;
  public accrualType!: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
  public allowCarryForward!: number;
  public maxCarryForward!: number;
  public allowEncashment!: number;
  public allowHalfDay!: number;
  public minimumNoticeDays!: number;
  public maximumAdvanceDays!: number;
  public maximumConsecutiveDays!: number;
  public allowNegativeBalance!: number;
  public requiresApproval!: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt?: number | null;
  
  public static associate(models: any): void {
    LeavePolicyRule.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeavePolicyRule.belongsTo(models.LeavePolicy, {
      foreignKey: 'leavePolicyId',
      as: 'leavePolicy',
    });

    LeavePolicyRule.belongsTo(models.LeaveType, {
      foreignKey: 'leaveTypeId',
      as: 'leaveType',
    });
  }
}

export function initLeavePolicyRule(sequelize: Sequelize): typeof LeavePolicyRule {
  LeavePolicyRule.init(
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
      leavePolicyId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      leaveTypeId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      annualEntitlement: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0
      },
      accrualType: {
        type: DataTypes.ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'),
        allowNull: false,
      },
      allowCarryForward: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      maxCarryForward: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      allowEncashment: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      allowHalfDay: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      minimumNoticeDays: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      maximumAdvanceDays: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      maximumConsecutiveDays: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      allowNegativeBalance: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      requiresApproval: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
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
      tableName: 'wd_leave_policy_rules',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'leavePolicyId', 'leaveTypeId'],
          name: 'uk_leave_policy_rule_host_leave_policy_leave_type',
        },
      ],
    }
  );

  return LeavePolicyRule;
}

export default LeavePolicyRule;