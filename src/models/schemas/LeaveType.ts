import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveTypeAttributes } from '../../types/leave.types';

interface LeaveTypeCreationAttributes extends Optional<LeaveTypeAttributes, 'id'> {}

class LeaveType extends Model<LeaveTypeAttributes, LeaveTypeCreationAttributes> implements LeaveTypeAttributes {
  public id!: number;
  public hostId!: number;
  public name!: string;
  public code!: string;
  public description?: string;
  public isPaid!: number;
  public allowHalfDay!: number;
  public allowPastDate!: number;
  public allowFutureDate!: number;
  public requiresDocument!: number;
  public documentAfterDays?: number;
  public color?: string;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;

  public static associate(models: any): void {
    LeaveType.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initLeaveType(sequelize: Sequelize): typeof LeaveType {
  LeaveType.init(
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
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isPaid: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      allowHalfDay: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      allowPastDate: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      allowFutureDate: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      requiresDocument: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      documentAfterDays: {
        type: DataTypes.SMALLINT, // Document required when leave duration is >= this many days
        allowNull: true,
      },
      color: {
        type: DataTypes.STRING(20),
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
      tableName: 'wd_leave_types',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'code'],
          name: 'uk_leave_type_host_code',
        },
        {
          fields: ['hostId', 'isEnabled', 'isDeleted'],
          name: 'idx_leave_type_host_status',
        },
      ],
    }
  );

  return LeaveType;
}

export default LeaveType;
