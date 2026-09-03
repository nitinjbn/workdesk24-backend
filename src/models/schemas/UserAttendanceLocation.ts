import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserAttendanceLocationAttributes } from '../../types';

interface UserAttendanceLocationCreationAttributes extends Optional<UserAttendanceLocationAttributes, 'id' | 'userId' | 'attendanceLocationId' | 'isEnabled' | 'createdAt' | 'updatedAt' > {}

class UserAttendanceLocation extends Model<UserAttendanceLocationAttributes, UserAttendanceLocationCreationAttributes> implements UserAttendanceLocationAttributes {
  public id!: number;
  public userId!: number;
  public attendanceLocationId!: number;
  public isEnabled: number;
  public createdAt: number;
  public updatedAt?: number;
  public deletedAt?: number | null;
  public isDeleted: number;

  public static associate(models: any): void {
    UserAttendanceLocation.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    UserAttendanceLocation.belongsTo(models.AttendanceLocation, {
      foreignKey: 'attendanceLocationId',
      as: 'attendanceLocation',
    });
  }
}

export function initUserAttendanceLocation(sequelize: Sequelize): typeof UserAttendanceLocation {
  UserAttendanceLocation.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      attendanceLocationId: {
        type: DataTypes.BIGINT,
        allowNull: false
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
      tableName: 'wd_user_attendance_locations',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['attendanceLocationId'] },
        { 
          unique: true, 
          name: 'uk_user_attendance_location', 
          fields: [ 'userId', 'attendanceLocationId', 'isDeleted']
        },
      ],
    }
  );

  return UserAttendanceLocation;
}

export default UserAttendanceLocation;
