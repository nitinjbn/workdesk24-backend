import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { HolidayAttributes } from '../../types/leave.types';

interface HolidayCreationAttributes extends Optional<HolidayAttributes, 'id'> {}

class Holiday extends Model<HolidayAttributes, HolidayCreationAttributes> implements HolidayAttributes {
  public id!: number;
  public hostId!: number;
  public holidayCalendarId!: number;
  public holidayDate!: string;
  public name!: string;
  public description?: string;
  public isOptional!: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt?: number | null;
  
  public static associate(models: any): void {
    Holiday.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    Holiday.belongsTo(models.HolidayCalendar, {
      foreignKey: 'holidayCalendarId',
      as: 'holidayCalendar',
    });
  }
}

export function initHoliday(sequelize: Sequelize): typeof Holiday {
  Holiday.init(
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
      holidayCalendarId: {
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
      holidayDate: {
        type: DataTypes.DATEONLY, // Holiday date in YYYY-MM-DD format
        allowNull: false,
      },
      isOptional: {
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
      tableName: 'wd_holidays',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'holidayCalendarId', 'holidayDate'],
          name: 'uk_holiday_host_calendar_date',
        },
      ],
    }
  );

  return Holiday;
}

export default Holiday;