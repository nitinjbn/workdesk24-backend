import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { HolidayCalendarAttributes } from '../../types/leave.types';

interface HolidayCalendarCreationAttributes extends Optional<HolidayCalendarAttributes, 'id'> {}

class HolidayCalendar extends Model<HolidayCalendarAttributes, HolidayCalendarCreationAttributes> implements HolidayCalendarAttributes {
  public id!: number;
  public hostId!: number;
  public leaveYearId!: number;
  public name!: string;
  public description?: string;
  public isDefault!: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  
  public static associate(models: any): void {
    HolidayCalendar.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    HolidayCalendar.belongsTo(models.LeaveYear, {
      foreignKey: 'leaveYearId',
      as: 'leaveYear',
    });
  }
}

export function initHolidayCalendar(sequelize: Sequelize): typeof HolidayCalendar {
  HolidayCalendar.init(
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
      leaveYearId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isDefault: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
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
      }
    },
    {
      sequelize,
      tableName: 'wd_holiday_calendars',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'leaveYearId', 'name'],
          name: 'uk_holiday_calendar_host_leave_year_name',
        },
      ],
    }
  );

  return HolidayCalendar;
}

export default HolidayCalendar;