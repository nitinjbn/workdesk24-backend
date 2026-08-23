import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveBalanceTransactionAttributes } from '../../types/leave.types';

interface LeaveBalanceTransactionCreationAttributes extends Optional<LeaveBalanceTransactionAttributes, 'id'> {}

class LeaveBalanceTransaction extends Model<LeaveBalanceTransactionAttributes, LeaveBalanceTransactionCreationAttributes> implements LeaveBalanceTransactionAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public leaveTypeId!: number;
  public leaveYearId!: number;
  public transactionType!: 'OPENING' | 'ALLOCATION' | 'ACCRUAL' | 'CARRY_FORWARD' | 'LEAVE_DEBIT' | 'LEAVE_REVERSAL' | 'ADJUSTMENT' | 'EXPIRY' | 'ENCASHMENT';
  public quantity!: number;
  public openingBalance!: number;
  public closingBalance!: number;
  public reason?: string;
  public createdBy?: number;
  public createdAt!: number;
  
  public static associate(models: any): void {
    LeaveBalanceTransaction.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeaveBalanceTransaction.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    LeaveBalanceTransaction.belongsTo(models.LeaveYear, {
      foreignKey: 'leaveYearId',
      as: 'leaveYear',
    });

    LeaveBalanceTransaction.belongsTo(models.LeaveType, {
      foreignKey: 'leaveTypeId',
      as: 'leaveType',
    });
  }
}

export function initLeaveBalanceTransaction(sequelize: Sequelize): typeof LeaveBalanceTransaction {
  LeaveBalanceTransaction.init(
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
      transactionType: {
        type: DataTypes.ENUM(
          'OPENING',
          'ALLOCATION',
          'ACCRUAL',
          'CARRY_FORWARD',
          'LEAVE_DEBIT',
          'LEAVE_REVERSAL',
          'ADJUSTMENT',
          'EXPIRY',
          'ENCASHMENT'
        ),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      openingBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      closingBalance: {
        type: DataTypes.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
      }
    },
    {
      sequelize,
      tableName: 'wd_leave_balance_transactions',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId', 'userId', 'leaveYearId', 'leaveTypeId', 'createdAt'],
          name: 'idx_leave_balance_transaction_employee',
        },
        {
          fields: ['hostId', 'transactionType', 'createdAt'],
          name: 'idx_leave_balance_transaction_type',
        }
      ]
    }
  );

  return LeaveBalanceTransaction;
}

export default LeaveBalanceTransaction;