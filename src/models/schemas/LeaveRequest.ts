import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveRequestAttributes } from '../../types/leave.types';

interface LeaveRequestCreationAttributes extends Optional<LeaveRequestAttributes, 'id'> {}

class LeaveRequest
  extends Model<LeaveRequestAttributes, LeaveRequestCreationAttributes>
  implements LeaveRequestAttributes
{
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public leaveTypeId!: number;
  public leaveYearId!: number;
  public fromDate!: string;
  public tillDate!: string;
  public totalDays!: number;
  public reason?: string;
  public status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
  public requestLocalId?: string;
  public submittedAt?: number;
  public approvedAt?: number;
  public rejectedAt?: number;
  public cancelledAt?: number;
  public withdrawnAt?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    LeaveRequest.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeaveRequest.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });

    LeaveRequest.belongsTo(models.LeaveType, {
      foreignKey: 'leaveTypeId',
      as: 'leaveType',
    });

    LeaveRequest.belongsTo(models.LeaveYear, {
      foreignKey: 'leaveYearId',
      as: 'leaveYear',
    });

    LeaveRequest.hasMany(models.LeaveRequestApproval, {
      foreignKey: 'leaveRequestId',
      as: 'approvalHistory',
    });
  }
}

export function initLeaveRequest(sequelize: Sequelize): typeof LeaveRequest {
  LeaveRequest.init(
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
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      leaveTypeId: {
        type: DataTypes.BIGINT,
        allowNull: true, // Made leaveTypeId optional due to phase 1 release without leave types
        defaultValue: 0,
      },
      leaveYearId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      fromDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      tillDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      totalDays: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'),
        allowNull: false,
      },
      requestLocalId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      submittedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      approvedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      rejectedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      withdrawnAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
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
      tableName: 'wd_leave_requests',
      timestamps: false,
      indexes: [
        {
          fields: ['hostId', 'userId', 'fromDate', 'tillDate'],
          name: 'idx_leave_request_host_user_dates',
        },
        {
          fields: ['hostId', 'status'],
          name: 'idx_leave_request_host_status',
        },
        {
          fields: ['hostId', 'leaveYearId', 'userId', 'fromDate'],
          name: 'idx_leave_request_host_year_user_date',
        },
        {
          fields: ['hostId', 'leaveTypeId', 'status'],
          name: 'idx_leave_request_host_type_status',
        },
        {
          unique: true,
          fields: ['hostId', 'userId', 'requestLocalId'],
          name: 'uk_leave_request_host_user_local_id',
        },
      ],
    }
  );

  return LeaveRequest;
}

export default LeaveRequest;
