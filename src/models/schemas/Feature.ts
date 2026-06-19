import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { FeatureAttributes } from '../../types';

interface FeatureCreationAttributes extends Optional<FeatureAttributes, 'id' | 'featureCode' | 'featureName' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Feature extends Model<FeatureAttributes , FeatureCreationAttributes > implements FeatureAttributes {
  public id!: number;
  public featureCode!: string;
  public featureName!: string;
  public remarks?: string;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Feature.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initFeature(sequelize: Sequelize): typeof Feature {
  Feature.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      featureCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      featureName: {
        type: DataTypes.STRING(50),
        allowNull: false,
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
      tableName: 'wd_features',
      timestamps: false,
      indexes: [
        { fields: ['featureCode'] },
        { fields: ['featureName'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return Feature;
}

export default Feature;