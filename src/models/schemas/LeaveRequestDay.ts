import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveRequestDayAttributes } from '../../types/leave.types';

interface LeaveRequestDayCreationAttributes extends Optional<LeaveRequestDayAttributes, 'id'> {}

class LeaveRequestDay extends Model<LeaveRequestDayAttributes, LeaveRequestDayCreationAttributes> implements LeaveRequestDayAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public leaveRequestId!: number;
  public leaveDate!: string;
  public durationType!: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
  public durationDays!: number;
  public createdAt!: number;
  public updatedAt!: number;
  
  public static associate(models: any): void {
    LeaveRequestDay.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    LeaveRequestDay.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    LeaveRequestDay.belongsTo(models.LeaveRequest, {
      foreignKey: 'leaveRequestId',
      as: 'leaveRequest',
    });
  }
}

export function initLeaveRequestDay(sequelize: Sequelize): typeof LeaveRequestDay {
  LeaveRequestDay.init(
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
      leaveRequestId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      leaveDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      durationType: {
        type: DataTypes.ENUM('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'),
        allowNull: false,
      },
      durationDays: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      }
    },
    {
      sequelize,
      tableName: 'wd_leave_request_days',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'leaveRequestId', 'leaveDate'],
          name: 'uk_leave_request_day_host_request_date',
        },
        {
          fields: ['hostId', 'userId', 'leaveDate'],
          name: 'idx_leave_request_day_host_user_date',
        }
      ],
    }
  );

  return LeaveRequestDay;
}

export default LeaveRequestDay;