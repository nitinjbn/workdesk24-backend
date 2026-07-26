import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { VisitSummaryAttributes } from '../../types';

interface VisitSummaryCreationAttributes extends Optional<VisitSummaryAttributes, 'id' | 'visitId' | 'createdAt' | 'updatedAt'> {}

class VisitSummary extends Model<VisitSummaryAttributes, VisitSummaryCreationAttributes> implements VisitSummaryAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public visitId!: number;
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
  public deletedAt?: number;

  public static associate(models: any): void {
    VisitSummary.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    VisitSummary.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    VisitSummary.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
  }
}

export function initVisitSummary(sequelize: Sequelize): typeof VisitSummary {
  VisitSummary.init(
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
      visitId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
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
      tableName: 'wd_visit_summary',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['visitId'] },
      ],
    }
  );

  return VisitSummary;
}

export default VisitSummary;
