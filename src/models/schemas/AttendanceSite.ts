import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { AttendanceSiteAttributes } from '../../types';

interface AttendanceSiteCreationAttributes extends Optional<
  AttendanceSiteAttributes,
  | 'id'
  | 'hostId'
  | 'siteName'
  | 'latitude'
  | 'longitude'
  | 'radiusMeters'
  | 'createdAt'
  | 'updatedAt'
> {}

class AttendanceSite
  extends Model<AttendanceSiteAttributes, AttendanceSiteCreationAttributes>
  implements AttendanceSiteAttributes
{
  public id!: number;
  public hostId!: number;
  public siteName: string;
  public latitude?: number;
  public longitude?: number;
  public radiusMeters?: number;
  public isEnabled: number;
  public createdAt: number;
  public updatedAt?: number;
  public deletedAt?: number | null;
  public isDeleted: number;

  public static associate(models: any): void {
    AttendanceSite.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
    AttendanceSite.hasMany(models.UserAttendanceSite, {
      foreignKey: 'attendanceSiteId',
      as: 'siteUsers',
    });
  }
}

export function initAttendanceSite(sequelize: Sequelize): typeof AttendanceSite {
  AttendanceSite.init(
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
      siteName: {
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
        allowNull: false,
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
      tableName: 'wd_attendance_sites',
      timestamps: false,
      indexes: [{ fields: ['hostId'] }],
    }
  );

  return AttendanceSite;
}

export default AttendanceSite;
