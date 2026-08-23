import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeavePolicyAttributes } from '../../types/leave.types';

interface LeavePolicyCreationAttributes extends Optional<LeavePolicyAttributes, 'id'> {}

class LeavePolicy extends Model<LeavePolicyAttributes, LeavePolicyCreationAttributes> implements LeavePolicyAttributes {
  public id!: number;
  public hostId!: number;
  public name!: string;
  public description?: string;
  public effectiveFrom!: string; // Start date of the leave policy in YYYY-MM-DD format
  public effectiveTill?: string; // End date of the leave policy in YYYY-MM-DD format (optional)
  public isDefault!: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt?: number | null;
  
  public static associate(models: any): void {
    LeavePolicy.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initLeavePolicy(sequelize: Sequelize): typeof LeavePolicy {
  LeavePolicy.init(
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      effectiveFrom: {
        type: DataTypes.DATEONLY, // Start date of the leave policy in YYYY-MM-DD format
        allowNull: false,
      },
      effectiveTill: {
        type: DataTypes.DATEONLY, // End date of the leave policy in YYYY-MM-DD format (optional)
        allowNull: true,
      },
      isDefault: {
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
      tableName: 'wd_leave_policies',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'name'],
          name: 'uk_leave_policy_host_name',
        },
      ],
    }
  );

  return LeavePolicy;
}

export default LeavePolicy;
