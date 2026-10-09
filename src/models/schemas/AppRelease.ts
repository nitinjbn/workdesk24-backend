import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { BaseModel } from '../../shared/types/base.types';

interface AppReleaseAttributes extends BaseModel {
  platform: 'ANDROID';
  versionName: string;
  versionCode: number;
  distributionChannel: 'WEBSITE' | 'PLAYSTORE';
  downloadUrl: string;
  apkSha256?: string | null;
  releaseNotes: string;
  isEnabled: boolean;
  createdAt: number;
}
interface AppReleaseCreationAttributes extends Optional<AppReleaseAttributes, 'id'> {}

class AppRelease
  extends Model<AppReleaseAttributes, AppReleaseCreationAttributes>
  implements AppReleaseAttributes
{
  public id!: number;
  public platform!: 'ANDROID';
  public versionName!: string;
  public versionCode!: number;
  public distributionChannel!: 'WEBSITE' | 'PLAYSTORE';
  public downloadUrl!: string;
  public apkSha256!: string | null;
  public releaseNotes!: string;
  public isEnabled!: boolean;
  public createdAt!: number;

  public static associate(models: any): void {
    // Define associations here if needed
  }
}

export function initAppRelease(sequelize: Sequelize): typeof AppRelease {
  AppRelease.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      platform: {
        type: DataTypes.ENUM('ANDROID'),
        allowNull: false,
      },
      versionName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      versionCode: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      distributionChannel: {
        type: DataTypes.ENUM('WEBSITE', 'PLAYSTORE'),
        allowNull: false,
      },
      downloadUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      apkSha256: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      releaseNotes: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'wd_app_releases',
      timestamps: false,
      underscored: false,
      indexes: [
        {
          name: 'idx_versionName',
          fields: ['versionName'],
        },
        {
          name: 'idx_versionCode',
          fields: ['versionCode'],
        },
      ],
    }
  );

  return AppRelease;
}

export default AppRelease;
