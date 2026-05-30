import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

interface AttendanceAttributes extends BaseModel {
  userId: number;
  localId?: string;
  checkInTime: number;
  checkOutTime?: number;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  workingHours?: number;
  status: 'checked_in' | 'checked_out';
  notes?: string;
  syncedAt?: number;
}

interface AttendanceCreationAttributes extends Optional<AttendanceAttributes, 'id' | 'checkOutTime' | 'checkInLat' | 'checkInLng' | 'checkOutLat' | 'checkOutLng' | 'workingHours' | 'notes' | 'syncedAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes> implements AttendanceAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public checkInTime!: number;
  public checkOutTime?: number;
  public checkInLat?: number;
  public checkInLng?: number;
  public checkOutLat?: number;
  public checkOutLng?: number;
  public workingHours?: number;
  public status!: 'checked_in' | 'checked_out';
  public notes?: string;
  public syncedAt?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;

  // Association placeholder
  public static associate(models: any): void {
    Attendance.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initAttendance(sequelize: Sequelize): typeof Attendance {
  Attendance.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      checkInTime: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      checkOutTime: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      checkInLat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      checkInLng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      checkOutLat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      checkOutLng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      workingHours: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('checked_in', 'checked_out'),
        defaultValue: 'checked_in',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
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
      tableName: 'wd_attendance',
      timestamps: false,
      hooks: {
        beforeCreate: async (attendance: Attendance) => {
          const now = Math.floor(Date.now() / 1000);
          attendance.createdAt = now;
          attendance.updatedAt = now;
          attendance.isDeleted = 0;
          attendance.deletedAt = null;
        },
        beforeUpdate: async (attendance: Attendance) => {
          attendance.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }
  );

  return Attendance;
}

export default Attendance;
