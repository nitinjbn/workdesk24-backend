import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

interface AppUpgradePolicyAttributes extends BaseModel {
  hostId: number | null;
  userId: number | null;
  scopeType: 'HOST' | 'USER' | 'GLOBAL';
  releaseId: number;
  forceUpdate: number;
  isEnabled: number;
  effectiveFrom: number;
  effectiveTill: number | null;
  message: string;
  createdAt: number | null;
}
interface AppUpgradePolicyCreationAttributes extends Optional<AppUpgradePolicyAttributes, 'id'> {}

class AppUpgradePolicy
  extends Model<AppUpgradePolicyAttributes, AppUpgradePolicyCreationAttributes>
  implements AppUpgradePolicyAttributes
{
  public id!: number;
  public hostId: number | null;
  public userId: number | null;
  public scopeType!: 'HOST' | 'USER' | 'GLOBAL';
  public releaseId!: number;
  public forceUpdate!: number;
  public isEnabled!: number;
  public effectiveFrom!: number;
  public effectiveTill: number | null;
  public message!: string;
  public createdAt: number | null;

  public static associate(models: any): void {
    AppUpgradePolicy.belongsTo(models.AppRelease, {
      foreignKey: 'releaseId',
      as: 'release',
    });
  }
}

export function initAppUpgradePolicy(sequelize: Sequelize): typeof AppUpgradePolicy {
  AppUpgradePolicy.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      scopeType: {
        type: DataTypes.ENUM('HOST', 'USER', 'GLOBAL'),
        allowNull: false,
      },
      releaseId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      forceUpdate: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      effectiveFrom: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      effectiveTill: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      message: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'wd_app_upgrade_policies',
      timestamps: false,
      underscored: false,
      indexes: [
        {
          name: 'idx_hostId',
          fields: ['hostId'],
        },
        {
          name: 'idx_userId',
          fields: ['userId'],
        },
        {
          name: 'idx_releaseId',
          fields: ['releaseId'],
        },
      ],
    }
  );

  return AppUpgradePolicy;
}

export default AppUpgradePolicy;
