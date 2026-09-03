import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { AttendanceLocationAttributes } from '../../types';

interface AttendanceLocationCreationAttributes extends Optional<AttendanceLocationAttributes, 'id' | 'hostId' | 'locationName' | 'latitude' | 'longitude' | 'radiusMeters' | 'createdAt' | 'updatedAt' > {}

class AttendanceLocation extends Model<AttendanceLocationAttributes, AttendanceLocationCreationAttributes> implements AttendanceLocationAttributes {
  public id!: number;
  public hostId!: number;
  public locationName: string;
  public latitude?: number;
  public longitude?: number;
  public radiusMeters?: number;
  public isEnabled: number;
  public createdAt: number;
  public updatedAt?: number;
  public deletedAt?: number | null;
  public isDeleted: number;

  public static associate(models: any): void {
    AttendanceLocation.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initAttendanceLocation(sequelize: Sequelize): typeof AttendanceLocation {
  AttendanceLocation.init(
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
      locationName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      radiusMeters: {
        type: DataTypes.INTEGER,
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
      tableName: 'wd_attendance_locations',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] }
      ],
    }
  );

  return AttendanceLocation;
}

export default AttendanceLocation;
