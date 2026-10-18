import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { FEATURES } from '../../config/features';

type ParentFeatureKey = keyof typeof FEATURES.DETAILS;

type SubFeatureKey = {
  [K in ParentFeatureKey]:
    typeof FEATURES.DETAILS[K] extends { SUB_FEATURES: infer S }
      ? keyof S
      : never;
}[ParentFeatureKey];

type FeatureKey = ParentFeatureKey | SubFeatureKey;

interface FeatureAttributes {
  id: number;
  hostId: number;
  featureKey: FeatureKey;
  parentFeatureKey?: ParentFeatureKey | null;
  remarks?: string;
  isEnabled?: number;
  createdAt?: number;
  updatedAt?: number;
}

interface FeatureCreationAttributes extends Optional<FeatureAttributes, 'id' | 'parentFeatureKey' | 'remarks' | 'isEnabled' | 'createdAt' | 'updatedAt'> {}

class Feature extends Model<FeatureAttributes , FeatureCreationAttributes > implements FeatureAttributes {
  public id!: number;
  public hostId!: number;
  public featureKey!: FeatureKey;
  public parentFeatureKey?: ParentFeatureKey | null;
  public remarks?: string;
  public isEnabled?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Feature.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initHostFeatures(sequelize: Sequelize): typeof Feature {
  Feature.init(
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
      featureKey: {
        type: DataTypes.ENUM(...Object.keys(FEATURES.DETAILS), ...Object.values(FEATURES.DETAILS).flatMap(f => 'SUB_FEATURES' in f ? Object.keys(f.SUB_FEATURES) : [])),
        allowNull: false,
      },
      parentFeatureKey: {
        type: DataTypes.ENUM(...Object.keys(FEATURES.DETAILS)),
        allowNull: true,
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
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'wd_host_features',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['isEnabled'] },
        { fields: ['featureKey'] },
        {
          unique: true,
          fields: ['hostId', 'featureKey'],
        },
        { fields: ['parentFeatureKey'] },
      ],
    }
  );

  return Feature;
}

export default Feature;