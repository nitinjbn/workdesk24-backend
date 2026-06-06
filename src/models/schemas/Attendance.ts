import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

interface AttendanceAttributes extends BaseModel {
  userId: number;
  localId?: string;
  attendanceStatus?: string;
  vehicleType?: string;
  vehicleCategory?: string;
  attendanceOdometerReading?: number;
  attendanceImage?: string;
  attendanceRemarks?: string;
  attendanceLatitude?: number;
  attendanceLongitude?: number;
  attendanceLocationAccuracy?: number;
  attendanceLocationAltitude?: number;
  attendanceLocationSpeed?: number;
  attendanceLocationProvider?: string;
  attendanceBatteryPercentage?: number;
  isChargingOnAttendance?: number;
  dayoverLatitude?: number;
  dayoverLongitude?: number;
  dayoverLocationAccuracy?: number;
  dayoverLocationAltitude?: number;
  dayoverLocationSpeed?: number;
  dayoverLocationProvider?: string;
  dayoverBatteryPercentage?: number;
  isChargingOnDayover?: number;
  dayoverRemarks?: string;
  workingHours?: number;
  syncedAt?: number;
}

interface AttendanceCreationAttributes extends Optional<AttendanceAttributes, 'id' | 'attendanceStatus' | 'vehicleType' | 'vehicleCategory' | 'attendanceOdometerReading' | 'attendanceImage' | 'attendanceRemarks' | 'attendanceLatitude' | 'attendanceLongitude' | 'attendanceLocationAccuracy' | 'attendanceLocationAltitude' | 'attendanceLocationSpeed' | 'attendanceLocationProvider' | 'attendanceBatteryPercentage' | 'isChargingOnAttendance' | 'dayoverLatitude' | 'dayoverLongitude' | 'dayoverLocationAccuracy' | 'dayoverLocationAltitude' | 'dayoverLocationSpeed' | 'dayoverLocationProvider' | 'dayoverBatteryPercentage' | 'isChargingOnDayover' | 'dayoverRemarks' | 'workingHours' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'isDeleted' | 'deletedAt'> {}

class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes> implements AttendanceAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public attendanceStatus?: string;
  public vehicleType?: string;
  public vehicleCategory?: string;
  public attendanceOdometerReading?: number;
  public attendanceImage?: string;
  public attendanceRemarks?: string;
  public attendanceLatitude?: number;
  public attendanceLongitude?: number;
  public attendanceLocationAccuracy?: number;
  public attendanceLocationAltitude?: number;
  public attendanceLocationSpeed?: number;
  public attendanceLocationProvider?: string;
  public attendanceBatteryPercentage?: number;
  public isChargingOnAttendance?: number;
  public dayoverLatitude?: number;
  public dayoverLongitude?: number;
  public dayoverLocationAccuracy?: number;
  public dayoverLocationAltitude?: number;
  public dayoverLocationSpeed?: number;
  public dayoverLocationProvider?: string;
  public dayoverBatteryPercentage?: number;
  public isChargingOnDayover?: number;
  public dayoverRemarks?: string;
  public workingHours?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public syncedAt?: number;
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
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      attendanceStatus: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      vehicleType: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      vehicleCategory: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      attendanceOdometerReading: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      attendanceImage: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      attendanceRemarks: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      attendanceLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false
      },
      attendanceLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false
      },
      attendanceLocationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      attendanceLocationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      attendanceLocationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      attendanceLocationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      attendanceBatteryPercentage: {
        type: DataTypes.SMALLINT,
        allowNull: true
      },
      isChargingOnAttendance: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      dayoverLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      dayoverLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      dayoverLocationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      dayoverLocationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      dayoverLocationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      dayoverLocationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      dayoverBatteryPercentage: {
        type: DataTypes.SMALLINT,
        allowNull: true
      },
      isChargingOnDayover: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      dayoverRemarks: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      syncedAt: {
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
      tableName: 'wd_attendance',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['attendanceStatus'] },
      ],
    }
  );

  return Attendance;
}

export default Attendance;
