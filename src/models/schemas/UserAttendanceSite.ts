import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserAttendanceSiteAttributes } from '../../types';

interface UserAttendanceSiteCreationAttributes extends Optional<
  UserAttendanceSiteAttributes,
  'id' | 'userId' | 'attendanceSiteId' | 'isEnabled' | 'createdAt' | 'updatedAt'
> {}

class UserAttendanceSite
  extends Model<UserAttendanceSiteAttributes, UserAttendanceSiteCreationAttributes>
  implements UserAttendanceSiteAttributes
{
  public id!: number;
  public userId!: number;
  public attendanceSiteId!: number;
  public isEnabled: number;
  public createdAt: number;
  public updatedAt?: number;
  public deletedAt?: number | null;
  public isDeleted: number;

  public static associate(models: any): void {
    UserAttendanceSite.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    UserAttendanceSite.belongsTo(models.AttendanceSite, {
      foreignKey: 'attendanceSiteId',
      as: 'attendanceSite',
    });
  }
}

export function initUserAttendanceSite(sequelize: Sequelize): typeof UserAttendanceSite {
  UserAttendanceSite.init(
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
      attendanceSiteId: {
        type: DataTypes.BIGINT,
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
      tableName: 'wd_user_attendance_sites',
      timestamps: false,
      indexes: [{ fields: ['userId'] }, { fields: ['attendanceSiteId'] }],
    }
  );

  return UserAttendanceSite;
}

export default UserAttendanceSite;
