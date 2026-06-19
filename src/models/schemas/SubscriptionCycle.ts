import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { SubscriptionCycleAttributes } from '../../types';

interface SubscriptionCycleCreationAttributes extends Optional<SubscriptionCycleAttributes, 'id' | 'cycleCode' | 'cycleName' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class SubscriptionCycle extends Model<SubscriptionCycleAttributes , SubscriptionCycleCreationAttributes > implements SubscriptionCycleAttributes {
  public id!: number;
  public cycleCode!: string;
  public cycleName!: string;
  public validityInMonths!: number;
  public perUserMonthlyPrice!: number;
  public perUserSetupPrice!: number;
  public minimumUsers!: number;
  public isPopular!: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    SubscriptionCycle.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initSubscriptionCycle(sequelize: Sequelize): typeof SubscriptionCycle {
  SubscriptionCycle.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      cycleCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      cycleName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      validityInMonths: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      perUserMonthlyPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      perUserSetupPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      minimumUsers: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      isPopular: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      sortOrder: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
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
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_subscription_cycles',
      timestamps: false,
      indexes: [
        { fields: ['cycleCode'] },
        { fields: ['cycleName'] },
        { fields: ['validityInMonths'] },
        { fields: ['perUserMonthlyPrice'] },
        { fields: ['perUserSetupPrice'] },
        { fields: ['minimumUsers'] },
        { fields: ['isPopular'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return SubscriptionCycle;
}

export default SubscriptionCycle;