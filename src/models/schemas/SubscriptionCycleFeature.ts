import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { SubscriptionCycleFeaturesAttributes } from '../../types';

interface SubscriptionCycleFeatureCreationAttributes extends Optional<SubscriptionCycleFeaturesAttributes, 'id' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class SubscriptionCycleFeature extends Model<SubscriptionCycleFeaturesAttributes , SubscriptionCycleFeatureCreationAttributes > implements SubscriptionCycleFeaturesAttributes {
  public id!: number;
  public subscriptionCycleId!: number;
  public featureId!: number;
  public remarks?: string;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    SubscriptionCycleFeature.belongsTo(models.SubscriptionCycle, {
      foreignKey: 'subscriptionCycleId',
      as: 'subscriptionCycle',
    });
    SubscriptionCycleFeature.belongsTo(models.Feature, {
      foreignKey: 'featureId',
      as: 'feature',
    });
  }
}

export function initSubscriptionCycleFeature(sequelize: Sequelize): typeof SubscriptionCycleFeature {
  SubscriptionCycleFeature.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      subscriptionCycleId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      featureId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      tableName: 'wd_subscription_cycles_features',
      timestamps: false,
      indexes: [
        { fields: ['subscriptionCycleId'] },
        { fields: ['featureId'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return SubscriptionCycleFeature;
}

export default SubscriptionCycleFeature;