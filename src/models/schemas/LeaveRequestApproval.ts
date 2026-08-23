import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveRequestApprovalAttributes } from '../../types/leave.types';

interface LeaveRequestApprovalCreationAttributes extends Optional<LeaveRequestApprovalAttributes, 'id'> {}

class LeaveRequestApproval extends Model<LeaveRequestApprovalAttributes, LeaveRequestApprovalCreationAttributes> implements LeaveRequestApprovalAttributes {
  public id!: number;
  public hostId!: number;
  public leaveRequestId!: number;
  public approverUserId!: number;
  public action!: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
  public previousStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
  public newStatus!: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
  public comment?: string;
  public createdAt!: number;
  
  public static associate(models: any): void {
    LeaveRequestApproval.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeaveRequestApproval.belongsTo(models.User, {
      foreignKey: 'approverUserId',
      as: 'approver',
    });
    
    LeaveRequestApproval.belongsTo(models.LeaveRequest, {
      foreignKey: 'leaveRequestId',
      as: 'leaveRequest',
    });
  }
}

export function initLeaveRequestApproval(sequelize: Sequelize): typeof LeaveRequestApproval {
  LeaveRequestApproval.init(
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
      leaveRequestId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      approverUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      action: {
        type: DataTypes.ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'),
        allowNull: false,
      },
      previousStatus: {
        type: DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'),
        allowNull: true,
      },
      newStatus: {
        type: DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'),
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      }
    },
    {
      sequelize,
      tableName: 'wd_leave_request_approvals',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId', 'leaveRequestId', 'createdAt'],
          name: 'idx_leave_request_approval_host_request_created',
        }
      ],
    }
  );

  return LeaveRequestApproval;
}

export default LeaveRequestApproval;