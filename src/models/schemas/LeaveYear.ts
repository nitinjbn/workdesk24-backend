import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { LeaveYearAttributes } from '../../types/leave.types';

interface LeaveYearCreationAttributes extends Optional<LeaveYearAttributes, 'id'> {}

class LeaveYear extends Model<LeaveYearAttributes, LeaveYearCreationAttributes> implements LeaveYearAttributes {
  public id!: number;
  public hostId!: number;
  public year!: number;
  public startDate!: string;
  public endDate!: string;
  public createdAt!: number;

  public static associate(models: any): void {
    LeaveYear.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initLeaveYear(sequelize: Sequelize): typeof LeaveYear {
  LeaveYear.init(
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
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATEONLY, // Start date of the leave year in YYYY-MM-DD format
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATEONLY, // End date of the leave year in YYYY-MM-DD format
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      }
    },
    {
      sequelize,
      tableName: 'wd_leave_years',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'year'],
          name: 'uk_leave_year_host_year',
        },
      ],
    }
  );

  return LeaveYear;
}

export default LeaveYear;
