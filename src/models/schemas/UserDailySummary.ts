import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserDailySummaryAttributes } from '../../types';

interface UserDailySummaryCreationAttributes extends Optional<UserDailySummaryAttributes, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {}

class UserDailySummary extends Model<UserDailySummaryAttributes, UserDailySummaryCreationAttributes> implements UserDailySummaryAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public attendanceStatus!: string;
  public attendanceTime!: number;
  public dayoverTime?: number;
  public workingMinutes!: number;
  public travelDistance!: number;
  public reportDate!: number;
  public totalVisits!: number;
  public totalOrders?: number;
  public orderAmount?: number;
  public totalUniqueProducts?: number;
  public totalQuantity?: number;
  public totalPayments?: number;
  public paymentAmount?: number;
  public totalFeedbacks?: number;
  public totalImages?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    UserDailySummary.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    UserDailySummary.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initUserDailySummary(sequelize: Sequelize): typeof UserDailySummary {
  UserDailySummary.init(
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
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      reportDate: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      attendanceStatus: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      attendanceTime: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      dayoverTime: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      workingMinutes: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      travelDistance: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalVisits: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      totalOrders: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      orderAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalUniqueProducts: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      totalQuantity: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      totalPayments: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      paymentAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalFeedbacks: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      totalImages: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
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
      tableName: 'wd_user_daily_summary',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['reportDate'] },
        {
          unique: true,
          fields: ['hostId', 'userId', 'reportDate'],
        },
      ],
    }
  );

  return UserDailySummary;
}

export default UserDailySummary;
