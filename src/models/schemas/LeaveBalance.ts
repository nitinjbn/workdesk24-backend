import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveBalanceAttributes } from '../../types/leave.types';

interface LeaveBalanceCreationAttributes extends Optional<LeaveBalanceAttributes, 'id'> {}

class LeaveBalance extends Model<LeaveBalanceAttributes, LeaveBalanceCreationAttributes> implements LeaveBalanceAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public leaveTypeId!: number;
  public leaveYearId!: number;
  public allocatedBalance!: number;
  public accruedBalance!: number;
  public carriedForwardBalance!: number;
  public usedBalance!: number;
  public pendingBalance!: number;
  public expiredBalance!: number;
  public availableBalance!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    LeaveBalance.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeaveBalance.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    LeaveBalance.belongsTo(models.LeaveYear, {
      foreignKey: 'leaveYearId',
      as: 'leaveYear',
    });

    LeaveBalance.belongsTo(models.LeaveType, {
      foreignKey: 'leaveTypeId',
      as: 'leaveType',
    });
  }
}

export function initLeaveBalance(sequelize: Sequelize): typeof LeaveBalance {
  LeaveBalance.init(
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
      leaveTypeId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      leaveYearId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      allocatedBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      accruedBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      carriedForwardBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      usedBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      pendingBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      expiredBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      availableBalance: {
        type: DataTypes.DECIMAL(5,2),
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
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      tableName: 'wd_leave_balances',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'userId', 'leaveYearId', 'leaveTypeId'],
          name: 'uk_employee_leave_balance_host_user_year_type',
        },
      ]
    }
  );

  return LeaveBalance;
}

export default LeaveBalance;